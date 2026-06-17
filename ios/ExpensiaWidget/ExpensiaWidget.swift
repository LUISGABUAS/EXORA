import WidgetKit
import SwiftUI

// MARK: - Data Model

struct WidgetExpense: Codable {
    let amount: Double
    let category: String
    let description: String
    let time: String
}

struct WidgetData: Codable {
    let monthTotal: Double
    let monthIncome: Double
    let dayTotal: Double
    let balance: Double
    let topCategory: String
    let lastExpenses: [WidgetExpense]
    let weeklyTotals: [Double]
    let updatedAt: String

    static var placeholder: WidgetData {
        WidgetData(
            monthTotal: 4280.50,
            monthIncome: 12000.00,
            dayTotal: 350.00,
            balance: 7719.50,
            topCategory: "Comida",
            lastExpenses: [
                WidgetExpense(amount: 180, category: "Comida", description: "Restaurante", time: "Hoy 2:30 PM"),
                WidgetExpense(amount: 85, category: "Transporte", description: "Uber", time: "Hoy 9:15 AM"),
            ],
            weeklyTotals: [320, 180, 450, 220, 380, 150, 350],
            updatedAt: ""
        )
    }
}

// MARK: - Shared Data Reader

func loadWidgetData() -> WidgetData {
    let defaults = UserDefaults(suiteName: "group.com.exora.finance.app")
    guard
        let jsonString = defaults?.string(forKey: "widgetData"),
        let data = jsonString.data(using: .utf8),
        let widgetData = try? JSONDecoder().decode(WidgetData.self, from: data)
    else {
        return .placeholder
    }
    // Verifica que los datos sean del mes actual
    // Si son de otro mes, retorna placeholder con 0s pero mantiene estructura
    let savedMonth = String(widgetData.updatedAt.prefix(7))
    let currentMonth = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM"
        return f.string(from: Date())
    }()
    if !widgetData.updatedAt.isEmpty && savedMonth != currentMonth {
        return WidgetData(
            monthTotal: 0, monthIncome: 0, dayTotal: 0, balance: 0,
            topCategory: "Otros", lastExpenses: [], weeklyTotals: [0,0,0,0,0,0,0],
            updatedAt: widgetData.updatedAt
        )
    }
    return widgetData
}

// MARK: - Timeline Provider

struct ExoraProvider: TimelineProvider {
    func placeholder(in context: Context) -> ExoraEntry {
        ExoraEntry(date: Date(), data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (ExoraEntry) -> Void) {
        completion(ExoraEntry(date: Date(), data: loadWidgetData()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ExoraEntry>) -> Void) {
        let entry = ExoraEntry(date: Date(), data: loadWidgetData())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct ExoraEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

// MARK: - Category Helpers

func categoryEmoji(_ category: String) -> String {
    switch category {
    case "Comida":          return "🍽️"
    case "Transporte":      return "🚗"
    case "Entretenimiento": return "🎬"
    case "Salud":           return "💊"
    case "Educacion":       return "📚"
    default:                return "💳"
    }
}

func categoryColor(_ category: String) -> Color {
    switch category {
    case "Comida":          return Color(hex: "22C55E")
    case "Transporte":      return Color(hex: "3B82F6")
    case "Entretenimiento": return Color(hex: "F59E0B")
    case "Salud":           return Color(hex: "EF4444")
    case "Educacion":       return Color(hex: "8B5CF6")
    default:                return Color(hex: "8E8E93")
    }
}

// MARK: - Small Widget

struct SmallWidgetView: View {
    let data: WidgetData

    var body: some View {
        ZStack {
            Color(hex: "0F0F0F")
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 4) {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(Color(hex: "22C55E"))
                    Text("Exora")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(Color(hex: "22C55E"))
                }
                Spacer()
                Text("Gastos del mes")
                    .font(.system(size: 11))
                    .foregroundColor(Color(hex: "8E8E93"))
                Text(formatMXN(data.monthTotal))
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                Divider().background(Color(hex: "2C2C2E"))
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Hoy")
                            .font(.system(size: 10))
                            .foregroundColor(Color(hex: "8E8E93"))
                        Text(formatMXN(data.dayTotal))
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(.white)
                            .minimumScaleFactor(0.7)
                            .lineLimit(1)
                    }
                    Spacer()
                    Text(categoryEmoji(data.topCategory))
                        .font(.system(size: 18))
                }
            }
            .padding(14)
        }
    }
}

// MARK: - Medium Widget

struct MediumWidgetView: View {
    let data: WidgetData

    var body: some View {
        ZStack {
            Color(hex: "0F0F0F")
            HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 4) {
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Color(hex: "22C55E"))
                        Text("Exora")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Color(hex: "22C55E"))
                    }
                    Spacer()
                    Text("Gastos del mes")
                        .font(.system(size: 11))
                        .foregroundColor(Color(hex: "8E8E93"))
                    Text(formatMXN(data.monthTotal))
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Spacer().frame(height: 10)
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Ingresos")
                                .font(.system(size: 9))
                                .foregroundColor(Color(hex: "8E8E93"))
                            Text(formatMXN(data.monthIncome))
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(hex: "22C55E"))
                                .minimumScaleFactor(0.6)
                                .lineLimit(1)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Balance")
                                .font(.system(size: 9))
                                .foregroundColor(Color(hex: "8E8E93"))
                            Text(formatMXN(data.balance))
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .foregroundColor(data.balance >= 0 ? Color(hex: "22C55E") : Color(hex: "EF4444"))
                                .minimumScaleFactor(0.6)
                                .lineLimit(1)
                        }
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)

                Divider()
                    .background(Color(hex: "2C2C2E"))
                    .padding(.vertical, 14)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Últimos gastos")
                        .font(.system(size: 10))
                        .foregroundColor(Color(hex: "8E8E93"))
                    ForEach(Array(data.lastExpenses.prefix(3).enumerated()), id: \.offset) { _, expense in
                        HStack(spacing: 6) {
                            Text(categoryEmoji(expense.category))
                                .font(.system(size: 14))
                            VStack(alignment: .leading, spacing: 1) {
                                Text(expense.description.isEmpty ? expense.category : expense.description)
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                Text(expense.time)
                                    .font(.system(size: 9))
                                    .foregroundColor(Color(hex: "8E8E93"))
                            }
                            Spacer()
                            Text(formatMXN(expense.amount))
                                .font(.system(size: 11, weight: .semibold, design: .rounded))
                                .foregroundColor(.white)
                        }
                    }
                    if data.lastExpenses.isEmpty {
                        Text("Sin gastos aún")
                            .font(.system(size: 11))
                            .foregroundColor(Color(hex: "8E8E93"))
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// MARK: - Large Widget

struct LargeWidgetView: View {
    let data: WidgetData
    private let dayLabels = ["L", "M", "Mi", "J", "V", "S", "D"]

    var body: some View {
        ZStack {
            Color(hex: "0F0F0F")
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Color(hex: "22C55E"))
                        Text("Exora")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Color(hex: "22C55E"))
                    }
                    Spacer()
                    Text(currentMonth())
                        .font(.system(size: 11))
                        .foregroundColor(Color(hex: "8E8E93"))
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)

                HStack(spacing: 0) {
                    statBlock(title: "Gastos", value: formatMXN(data.monthTotal), color: .white)
                    Divider().background(Color(hex: "2C2C2E")).padding(.vertical, 8)
                    statBlock(title: "Ingresos", value: formatMXN(data.monthIncome), color: Color(hex: "22C55E"))
                    Divider().background(Color(hex: "2C2C2E")).padding(.vertical, 8)
                    statBlock(title: "Balance", value: formatMXN(data.balance), color: data.balance >= 0 ? Color(hex: "22C55E") : Color(hex: "EF4444"))
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)

                Divider().background(Color(hex: "2C2C2E")).padding(.horizontal, 16).padding(.top, 10)

                Text("Esta semana")
                    .font(.system(size: 11))
                    .foregroundColor(Color(hex: "8E8E93"))
                    .padding(.horizontal, 16)
                    .padding(.top, 10)

                WeeklyBarChart(totals: data.weeklyTotals, labels: dayLabels)
                    .frame(height: 60)
                    .padding(.horizontal, 16)
                    .padding(.top, 6)

                Divider().background(Color(hex: "2C2C2E")).padding(.horizontal, 16).padding(.top, 10)

                Text("Últimos gastos")
                    .font(.system(size: 11))
                    .foregroundColor(Color(hex: "8E8E93"))
                    .padding(.horizontal, 16)
                    .padding(.top, 10)

                VStack(spacing: 8) {
                    ForEach(Array(data.lastExpenses.prefix(4).enumerated()), id: \.offset) { _, expense in
                        HStack(spacing: 10) {
                            ZStack {
                                Circle()
                                    .fill(categoryColor(expense.category).opacity(0.15))
                                    .frame(width: 30, height: 30)
                                Text(categoryEmoji(expense.category))
                                    .font(.system(size: 14))
                            }
                            VStack(alignment: .leading, spacing: 1) {
                                Text(expense.description.isEmpty ? expense.category : expense.description)
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                Text(expense.time)
                                    .font(.system(size: 10))
                                    .foregroundColor(Color(hex: "8E8E93"))
                            }
                            Spacer()
                            Text(formatMXN(expense.amount))
                                .font(.system(size: 13, weight: .semibold, design: .rounded))
                                .foregroundColor(.white)
                        }
                    }
                    if data.lastExpenses.isEmpty {
                        Text("Sin gastos este mes")
                            .font(.system(size: 12))
                            .foregroundColor(Color(hex: "8E8E93"))
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)

                Spacer()
            }
        }
    }

    @ViewBuilder
    func statBlock(title: String, value: String, color: Color) -> some View {
        VStack(alignment: .center, spacing: 2) {
            Text(title)
                .font(.system(size: 10))
                .foregroundColor(Color(hex: "8E8E93"))
            Text(value)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(color)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Weekly Bar Chart

struct WeeklyBarChart: View {
    let totals: [Double]
    let labels: [String]

    var body: some View {
        let maxVal = totals.max() ?? 1
        HStack(alignment: .bottom, spacing: 0) {
            ForEach(0..<min(totals.count, labels.count), id: \.self) { i in
                VStack(spacing: 4) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            i == currentDayIndex()
                                ? Color(hex: "22C55E")
                                : Color(hex: "22C55E").opacity(0.3)
                        )
                        .frame(height: max(4, CGFloat(totals[i] / maxVal) * 44))
                    Text(labels[i])
                        .font(.system(size: 9))
                        .foregroundColor(
                            i == currentDayIndex()
                                ? Color(hex: "22C55E")
                                : Color(hex: "8E8E93")
                        )
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func currentDayIndex() -> Int {
        let weekday = Calendar.current.component(.weekday, from: Date())
        return (weekday + 5) % 7
    }
}

// MARK: - Entry View

struct ExoraWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: ExoraEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(data: entry.data)
        case .systemMedium:
            MediumWidgetView(data: entry.data)
        case .systemLarge:
            LargeWidgetView(data: entry.data)
        default:
            SmallWidgetView(data: entry.data)
        }
    }
}

// MARK: - Widget Declaration

struct ExoraWidget: Widget {
    let kind: String = "ExoraWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ExoraProvider()) { entry in
            ExoraWidgetEntryView(entry: entry)
                .containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Exora")
        .description("Tus gastos e ingresos de un vistazo.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Helpers

func formatMXN(_ amount: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "MXN"
    formatter.currencySymbol = "$"
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: amount)) ?? "$\(Int(amount))"
}

func currentMonth() -> String {
    let months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
    let m = Calendar.current.component(.month, from: Date()) - 1
    return months[m]
}

extension Color {
    init(hex: String) {
        let scanner = Scanner(string: hex)
        var rgb: UInt64 = 0
        scanner.scanHexInt64(&rgb)
        let r = Double((rgb >> 16) & 0xFF) / 255
        let g = Double((rgb >> 8) & 0xFF) / 255
        let b = Double(rgb & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
