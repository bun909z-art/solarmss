import SwiftUI
import UIKit
import WebKit

@MainActor
final class SolarBrowser: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    @Published private(set) var site: URL?
    @Published private(set) var page: SolarPage = .home
    @Published private(set) var loading = false
    @Published private(set) var failure: String?
    @Published private(set) var finishedCount = 0

    private(set) var webView: WKWebView!
    private var navigation: WKNavigation?
    private var requestedPage: SolarPage = .home

    override init() {
        super.init()
        let configuration = WKWebViewConfiguration()
        configuration.applicationNameForUserAgent = "MaiSonSolarIOS/1.0"
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
    }

    func connect(_ url: URL) {
        guard site != url else { return }
        webView.stopLoading()
        site = url
        open(.home)
    }

    func open(_ page: SolarPage) {
        guard let site, let url = URL(string: page.rawValue, relativeTo: site)?.absoluteURL else { return }
        requestedPage = page
        failure = nil
        loading = true
        navigation = webView.load(URLRequest(url: url, timeoutInterval: 20))
    }

    func reload() {
        failure = nil
        if let url = webView.url, let site, SiteAddress.sameOrigin(url, as: site) {
            navigation = webView.reload()
        } else {
            open(requestedPage)
        }
    }

    func capturePlan() async throws -> PlanSnapshot {
        let result = try await runPlanScript("return JSON.stringify(api.capture());")
        guard let json = result as? String else { throw PlanError.invalid }
        return try PlanSnapshot(json: json)
    }

    func restorePlan(_ plan: SolarPlan) async throws -> String {
        (try await runPlanScript("return api.restore(JSON.parse(plan));", arguments: ["plan": plan.snapshot.json])) as? String ?? ""
    }

    private func runPlanScript(_ action: String, arguments: [String: Any] = [:]) async throws -> Any? {
        guard let site, let url = webView.url, SiteAddress.sameOrigin(url, as: site), SolarPage.at(url) == .demo else {
            throw PlanError.unavailable
        }
        let prelude = """
        for (let tries = 0; tries < 50; tries++) {
            const api = window.MaiSonSolarPlans;
            if (api?.availability() === 'disabled') return { error: 'Demo 3D đang được tạm tắt.' };
            if (api?.availability() === 'ready') {
                try {
        """
        let suffix = """
                } catch (error) { return { error: error.message }; }
            }
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        return { error: 'Demo 3D chưa sẵn sàng. Hãy tải lại trang và thử lại.' };
        """
        let result = try await webView.callAsyncJavaScript(prelude + "\n" + action + "\n" + suffix,
                                                           arguments: arguments, in: nil, contentWorld: .page)
        if let error = (result as? [String: String])?["error"] { throw PlanError.message(error) }
        return result
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, let site else { decisionHandler(.cancel); return }
        let scheme = url.scheme?.lowercased()
        if SiteAddress.sameOrigin(url, as: site), SolarPage.at(url) != nil {
            if action.targetFrame == nil {
                decisionHandler(.cancel)
                navigation = webView.load(action.request)
            } else {
                decisionHandler(.allow)
            }
        } else {
            decisionHandler(.cancel)
            if action.navigationType == .linkActivated || action.targetFrame == nil,
               scheme == "https" || scheme == "tel" || scheme == "mailto" {
                UIApplication.shared.open(url)
            }
        }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        self.navigation = navigation
        loading = true
        failure = nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard navigation === self.navigation else { return }
        loading = false
        if let url = webView.url, let page = SolarPage.at(url) { self.page = page }
        finishedCount += 1
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        finishFailed(navigation, error: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        finishFailed(navigation, error: error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loading = false
        failure = "Trang vừa đóng. Hãy tải lại để tiếp tục."
    }

    private func finishFailed(_ navigation: WKNavigation?, error: Error) {
        guard navigation === self.navigation, (error as NSError).code != NSURLErrorCancelled else { return }
        loading = false
        failure = "Không mở được website. Kiểm tra mạng và địa chỉ máy chủ rồi thử tải lại."
    }
}

struct WebsiteSurface: UIViewRepresentable {
    let browser: SolarBrowser

    func makeUIView(context: Context) -> WKWebView { browser.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
