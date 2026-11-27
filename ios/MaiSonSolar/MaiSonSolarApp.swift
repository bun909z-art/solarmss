import SwiftUI

@main
struct MaiSonSolarApp: App {
    var body: some Scene {
        WindowGroup { SolarWorkspace() }
    }
}

private enum WorkspaceTab: CaseIterable {
    case home, consultation, products, demo, plans

    var page: SolarPage? {
        switch self {
        case .home: .home
        case .consultation: .consultation
        case .products: .products
        case .demo: .demo
        case .plans: nil
        }
    }

    var title: String {
        switch self {
        case .home: "Trang chủ"
        case .consultation: "Tư vấn"
        case .products: "Thiết bị"
        case .demo: "Demo 3D"
        case .plans: "Đã lưu"
        }
    }

    var icon: String {
        switch self {
        case .home: "house"
        case .consultation: "bolt.circle"
        case .products: "shippingbox"
        case .demo: "cube.transparent"
        case .plans: "square.stack"
        }
    }
}

private struct SolarWorkspace: View {
    @Environment(\.dynamicTypeSize) private var textSize
    @AppStorage("solar.site.address") private var savedSite = ""
    @StateObject private var browser = SolarBrowser()
    @StateObject private var library = PlanLibrary()
    @State private var tab: WorkspaceTab = .home
    @State private var settingsVisible = false
    @State private var snapshot: PlanSnapshot?
    @State private var planToOpen: SolarPlan?
    @State private var operationInProgress = false
    @State private var notice = ""

    private let solarTint = Color(red: 0.08, green: 0.37, blue: 0.30)

    var body: some View {
        VStack(spacing: 0) {
            header
            ZStack {
                if browser.site != nil {
                    WebsiteSurface(browser: browser)
                        .opacity(tab == .plans || browser.failure != nil ? 0 : 1)
                        .accessibilityHidden(tab == .plans || browser.failure != nil)
                        .allowsHitTesting(tab != .plans && browser.failure == nil)
                }
                if tab == .plans {
                    PlanLibraryView(library: library, openPlan: openPlan, reportError: { notice = $0 })
                } else if browser.site == nil {
                    ContentUnavailableView {
                        Label("Kết nối Mai Sơn Solar", systemImage: "bolt.circle")
                    } description: {
                        Text("Nhập địa chỉ HTTPS của website để mở công cụ tư vấn và mô phỏng.")
                    } actions: {
                        Button("Nhập địa chỉ website") { settingsVisible = true }.buttonStyle(.borderedProminent)
                    }
                } else if let failure = browser.failure {
                    ContentUnavailableView {
                        Label("Mất kết nối", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(failure)
                    } actions: {
                        Button("Tải lại", action: browser.reload).buttonStyle(.borderedProminent)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            navigationBar
        }
        .background(Color(uiColor: .systemBackground))
        .tint(solarTint)
        .onAppear {
            if browser.site == nil, let site = SiteAddress.parse(savedSite) ?? bundledSite {
                browser.connect(site)
            }
        }
        .onChange(of: browser.finishedCount) { _, _ in pageFinished() }
        .sheet(isPresented: $settingsVisible) {
            SiteSettings(initialAddress: browser.site?.absoluteString ?? "", adminURL: adminURL) { url in
                savedSite = url.absoluteString
                guard browser.site != url else { return }
                tab = .home
                browser.connect(url)
            }
        }
        .sheet(item: $snapshot) { captured in
            SavePlanSheet(metrics: captured.summary) { name in
                try library.add(captured, name: name)
            }
        }
        .alert("Mai Sơn Solar", isPresented: Binding(get: { !notice.isEmpty }, set: { if !$0 { notice = "" } })) {
            Button("Đóng", role: .cancel) { notice = "" }
        } message: { Text(notice) }
    }

    private var bundledSite: URL? {
        (Bundle.main.object(forInfoDictionaryKey: "MaiSonSolarSiteURL") as? String).flatMap(SiteAddress.parse)
    }

    private var adminURL: URL? { browser.site?.appending(path: "admin") }

    private var header: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                if browser.canGoBack && tab != .plans {
                    Button(action: browser.back) { Image(systemName: "chevron.left") }
                        .accessibilityLabel("Trang trước")
                        .frame(minWidth: 28, minHeight: 44)
                }
                Image(systemName: "sun.max.fill")
                    .foregroundStyle(.yellow)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Mai Sơn Solar").font(.headline).lineLimit(1)
                    Text(tab == .plans ? "Phương án của bạn" : browser.page.title)
                        .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer(minLength: 4)
                if tab != .plans && browser.page == .demo && !browser.loading && browser.failure == nil {
                    Button(action: saveDraft) { Label("Lưu", systemImage: "bookmark") }
                        .labelStyle(.iconOnly).accessibilityLabel("Lưu phương án Demo 3D")
                        .frame(minWidth: 38, minHeight: 44)
                        .disabled(operationInProgress)
                }
                Menu {
                    Button("Tin tức", systemImage: "newspaper") { navigate(.news) }
                        .disabled(browser.site == nil)
                    Button("Tải lại", systemImage: "arrow.clockwise", action: browser.reload)
                        .disabled(browser.site == nil)
                    Button("Cài đặt", systemImage: "gearshape") { settingsVisible = true }
                } label: {
                    Image(systemName: "ellipsis.circle").font(.title3).frame(minWidth: 44, minHeight: 44)
                }.accessibilityLabel("Menu ứng dụng")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 5)
            if browser.loading && tab != .plans { ProgressView().progressViewStyle(.linear) }
            else { Divider() }
        }.background(.regularMaterial)
    }

    private var navigationBar: some View {
        HStack(spacing: 0) {
            ForEach(WorkspaceTab.allCases, id: \.self) { item in
                Button {
                    tab = item
                    if let page = item.page, browser.page != page || browser.failure != nil { browser.open(page) }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: item.icon).font(.body)
                        if !textSize.isAccessibilitySize { Text(item.title).font(.caption2).lineLimit(1) }
                    }
                    .foregroundStyle(tab == item ? solarTint : Color.secondary)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.title)
                .accessibilityAddTraits(tab == item ? [.isSelected] : [])
            }
        }
        .padding(.horizontal, 7)
        .background(.bar)
        .overlay(alignment: .top) { Divider() }
    }

    private func navigate(_ page: SolarPage) {
        tab = WorkspaceTab.allCases.first { $0.page == page } ?? .products
        browser.open(page)
    }

    private func saveDraft() {
        operationInProgress = true
        Task {
            defer { operationInProgress = false }
            do { snapshot = try await browser.capturePlan() }
            catch { notice = error.localizedDescription }
        }
    }

    private func openPlan(_ plan: SolarPlan) {
        guard browser.site != nil else { settingsVisible = true; return }
        planToOpen = plan
        navigate(.demo)
    }

    private func pageFinished() {
        guard tab != .plans else { return }
        let page = browser.page
        tab = WorkspaceTab.allCases.first { $0.page == page } ?? .products
        guard let plan = planToOpen else { return }
        planToOpen = nil
        guard page == .demo else { notice = "Demo 3D hiện chưa mở. Phương án vẫn có trong mục Đã lưu."; return }
        operationInProgress = true
        Task {
            defer { operationInProgress = false }
            do {
                let warning = try await browser.restorePlan(plan)
                if !warning.isEmpty { notice = warning }
            } catch { notice = error.localizedDescription }
        }
    }
}

private struct SiteSettings: View {
    @Environment(\.dismiss) private var dismiss
    @State var initialAddress: String
    let adminURL: URL?
    let connect: (URL) -> Void
    @State private var invalidAddress = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Website sử dụng chung dữ liệu") {
                    TextField("Địa chỉ HTTPS", text: $initialAddress)
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    if invalidAddress { Text("Nhập địa chỉ website HTTPS, ví dụ solarmss.onrender.com.").foregroundStyle(.red) }
                }
                if let adminURL {
                    Section("Quản trị") { Link("Mở Admin trong Safari", destination: adminURL) }
                }
            }
            .navigationTitle("Cài đặt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Đóng") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Kết nối") {
                        guard let url = SiteAddress.parse(initialAddress) else { invalidAddress = true; return }
                        connect(url)
                        dismiss()
                    }
                }
            }
        }
    }
}

private struct SavePlanSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = "Phương án " + Date.now.formatted(date: .numeric, time: .omitted)
    @State private var failure = ""
    let metrics: PlanMetrics
    let save: (String) throws -> Void

    var body: some View {
        NavigationStack {
            Form {
                TextField("Tên phương án", text: $name)
                    .submitLabel(.done).onSubmit(savePlan)
                Section("Kết quả mô phỏng") {
                    ForEach(metrics.rows) { row in LabeledContent(row.label, value: row.display) }
                }
                if !failure.isEmpty { Text(failure).foregroundStyle(.red) }
            }
            .navigationTitle("Lưu phương án")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Hủy") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lưu", action: savePlan).disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func savePlan() {
        do { try save(name); dismiss() }
        catch { failure = "Chưa lưu được phương án. " + error.localizedDescription }
    }
}
