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
    @StateObject private var browser = SolarBrowser()
    @StateObject private var library = PlanLibrary()
    @State private var tab: WorkspaceTab = .home
    @State private var snapshot: PlanSnapshot?
    @State private var planToOpen: SolarPlan?
    @State private var operationInProgress = false
    @State private var notice = ""

    private let solarTint = Color(red: 0.08, green: 0.37, blue: 0.30)

    var body: some View {
        VStack(spacing: 0) {
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
                    ContentUnavailableView("Chưa kết nối được website", systemImage: "wifi.exclamationmark")
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
            if tab == .demo && browser.page == .demo && !browser.loading && browser.failure == nil {
                HStack {
                    Spacer()
                    Button(action: saveDraft) {
                        Label("Lưu phương án", systemImage: "bookmark")
                            .frame(minHeight: 36)
                    }
                    .buttonStyle(.bordered)
                    .disabled(operationInProgress)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 4)
                .background(.bar)
            }
            navigationBar
        }
        .background(Color(uiColor: .systemBackground))
        .tint(solarTint)
        .statusBarHidden(true)
        .onAppear {
            if browser.site == nil, let site = bundledSite {
                browser.connect(site)
            }
        }
        .onChange(of: browser.finishedCount) { _, _ in pageFinished() }
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
        .overlay(alignment: .top) {
            if browser.loading && tab != .plans { ProgressView().progressViewStyle(.linear) }
            else { Divider() }
        }
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
        guard browser.site != nil else { notice = "Chưa kết nối được website để mở phương án."; return }
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
