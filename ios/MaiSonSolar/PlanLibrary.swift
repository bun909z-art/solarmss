import SwiftUI

enum PlanError: LocalizedError {
    case unavailable, invalid, message(String)

    var errorDescription: String? {
        switch self {
        case .unavailable: "Hãy mở Demo 3D rồi thử lại."
        case .invalid: "Không đọc được phương án mô phỏng."
        case .message(let text): text
        }
    }
}

struct PlanMetrics: Codable {
    let panelCount: Int
    let solarKw: Double
    let batteryKwh: Double
    let dailySolarKwh: Double
    let dailyLoadKwh: Double
    let dailyGridKwh: Double

    var rows: [Metric] {
        [Metric(label: "Số tấm đã xếp", display: "\(panelCount) tấm"),
         Metric(label: "Công suất giàn pin", display: Self.value(solarKw, unit: "kWp")),
         Metric(label: "Dung lượng lưu trữ", display: Self.value(batteryKwh, unit: "kWh")),
         Metric(label: "Sản lượng mặt trời", display: Self.value(dailySolarKwh, unit: "kWh/ngày")),
         Metric(label: "Điện tiêu thụ", display: Self.value(dailyLoadKwh, unit: "kWh/ngày")),
         Metric(label: "Điện từ lưới", display: Self.value(dailyGridKwh, unit: "kWh/ngày"))]
    }

    struct Metric: Identifiable {
        var id: String { label }
        let label: String
        let display: String
    }

    private static func value(_ number: Double, unit: String) -> String {
        number.formatted(.number.precision(.fractionLength(0...2))) + " " + unit
    }
}

struct PlanSnapshot: Codable, Identifiable {
    var id: String { json }
    let json: String
    let summary: PlanMetrics

    init(json: String) throws {
        struct Envelope: Decodable {
            let version: Int
            let summary: PlanMetrics
        }
        let data = Data(json.utf8)
        guard data.count <= 65_536, let envelope = try? JSONDecoder().decode(Envelope.self, from: data),
              envelope.version == 1 else { throw PlanError.invalid }
        self.json = json
        summary = envelope.summary
    }
}

struct SolarPlan: Codable, Identifiable {
    let id: UUID
    let name: String
    let savedAt: Date
    let snapshot: PlanSnapshot
}

@MainActor
final class PlanLibrary: ObservableObject {
    @Published private(set) var plans: [SolarPlan] = []
    @Published private(set) var readFailed = false

    private let file: URL = URL.applicationSupportDirectory.appending(path: "mai-son-solar-plans.json")

    init() {
        do {
            let data = try Data(contentsOf: file)
            plans = try JSONDecoder().decode([SolarPlan].self, from: data)
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile {
            return
        } catch {
            readFailed = true
        }
    }

    func add(_ snapshot: PlanSnapshot, name: String) throws {
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { throw PlanError.message("Hãy nhập tên phương án.") }
        try write([SolarPlan(id: UUID(), name: String(name.prefix(100)), savedAt: .now, snapshot: snapshot)] + plans)
    }

    func delete(_ plan: SolarPlan) throws {
        try write(plans.filter { $0.id != plan.id })
    }

    private func write(_ updated: [SolarPlan]) throws {
        guard !readFailed else { throw PlanError.message("Không đọc được dữ liệu phương án đã lưu trên thiết bị.") }
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(updated).write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        plans = updated
    }
}

struct PlanLibraryView: View {
    @ObservedObject var library: PlanLibrary
    let openPlan: (SolarPlan) -> Void
    let reportError: (String) -> Void
    @State private var compared: Set<UUID> = []
    @State private var showingComparison = false
    @State private var toDelete: SolarPlan?

    var body: some View {
        if library.readFailed {
            ContentUnavailableView("Chưa đọc được thư viện", systemImage: "exclamationmark.triangle",
                                   description: Text("Thử mở lại ứng dụng để đọc phương án đã lưu."))
        } else if library.plans.isEmpty {
            ContentUnavailableView("Chưa có phương án", systemImage: "square.stack",
                                   description: Text("Mở Demo 3D, thiết kế hệ thống và bấm Lưu để so sánh các phương án tại đây."))
        } else {
            List {
                Section {
                    ForEach(library.plans) { plan in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(plan.name).font(.headline)
                            Text(plan.savedAt.formatted(date: .abbreviated, time: .shortened))
                                .font(.caption).foregroundStyle(.secondary)
                            Text(plan.snapshot.summary.rows.prefix(3).map(\.display).joined(separator: " · "))
                                .font(.subheadline).foregroundStyle(.secondary)
                            HStack {
                                Button("Mở thiết kế") { openPlan(plan) }.buttonStyle(.borderedProminent)
                                Button {
                                    if compared.contains(plan.id) { compared.remove(plan.id) }
                                    else if compared.count < 2 { compared.insert(plan.id) }
                                } label: {
                                    Label("So sánh", systemImage: compared.contains(plan.id) ? "checkmark.circle.fill" : "circle")
                                }.buttonStyle(.bordered)
                                  .disabled(compared.count == 2 && !compared.contains(plan.id))
                            }
                        }
                        .padding(.vertical, 6)
                        .swipeActions {
                            Button("Xóa", role: .destructive) { toDelete = plan }
                        }
                    }
                } header: {
                    Text("Lưu trên iPhone · Chọn hai phương án để so sánh")
                }
                if compared.count == 2 {
                    Button("So sánh hai phương án") { showingComparison = true }
                }
            }
            .sheet(isPresented: $showingComparison) {
                PlanComparisonView(plans: library.plans.filter { compared.contains($0.id) })
            }
            .confirmationDialog("Xóa phương án này?", isPresented: Binding(
                get: { toDelete != nil }, set: { if !$0 { toDelete = nil } }), titleVisibility: .visible) {
                if let plan = toDelete {
                    Button("Xóa phương án", role: .destructive) {
                        do { try library.delete(plan); compared.remove(plan.id) }
                        catch { reportError("Chưa xóa được phương án trên iPhone.") }
                        toDelete = nil
                    }
                }
            }
        }
    }
}

private struct PlanComparisonView: View {
    let plans: [SolarPlan]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if plans.count == 2 {
                    let first = plans[0]
                    let second = plans[1]
                    ForEach(first.snapshot.summary.rows.indices, id: \.self) { index in
                        let left = first.snapshot.summary.rows[index]
                        let right = second.snapshot.summary.rows[index]
                        Section(left.label) {
                            LabeledContent(first.name, value: left.display)
                            LabeledContent(second.name, value: right.display)
                        }
                    }
                }
            }
            .navigationTitle("So sánh phương án")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Xong") { dismiss() } } }
        }
    }
}
