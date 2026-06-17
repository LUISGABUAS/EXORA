import WidgetKit
import SwiftUI

// MARK: - Quick Add Provider

struct QuickAddProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickAddEntry {
        QuickAddEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickAddEntry) -> Void) {
        completion(QuickAddEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickAddEntry>) -> Void) {
        let entry = QuickAddEntry(date: Date())
        completion(Timeline(entries: [entry], policy: .never))
    }
}

struct QuickAddEntry: TimelineEntry {
    let date: Date
}

// MARK: - Quick Add Widget View

struct QuickAddWidgetView: View {
    var body: some View {
        ZStack {
            Color(hex: "0F0F0F")
            VStack(spacing: 10) {
                HStack(spacing: 4) {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(Color(hex: "22C55E"))
                    Text("Exora")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(Color(hex: "22C55E"))
                }

                // Add Expense button
                Link(destination: URL(string: "exora://add-expense")!) {
                    HStack(spacing: 8) {
                        ZStack {
                            Circle()
                                .fill(Color(hex: "EF4444").opacity(0.15))
                                .frame(width: 32, height: 32)
                            Image(systemName: "minus.circle.fill")
                                .font(.system(size: 16))
                                .foregroundColor(Color(hex: "EF4444"))
                        }
                        Text("Agregar gasto")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10))
                            .foregroundColor(Color(hex: "8E8E93"))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color(hex: "1C1C1E"))
                    .cornerRadius(12)
                }

                // Add Income button
                Link(destination: URL(string: "exora://add-income")!) {
                    HStack(spacing: 8) {
                        ZStack {
                            Circle()
                                .fill(Color(hex: "22C55E").opacity(0.15))
                                .frame(width: 32, height: 32)
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 16))
                                .foregroundColor(Color(hex: "22C55E"))
                        }
                        Text("Agregar ingreso")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10))
                            .foregroundColor(Color(hex: "8E8E93"))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color(hex: "1C1C1E"))
                    .cornerRadius(12)
                }
            }
            .padding(14)
        }
    }
}

// MARK: - Widget Declaration

struct QuickAddWidget: Widget {
    let kind: String = "ExoraQuickAddWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickAddProvider()) { _ in
            QuickAddWidgetView()
                .containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Exora — Acceso rápido")
        .description("Agrega un gasto o ingreso directamente desde tu pantalla de inicio.")
        .supportedFamilies([.systemMedium])
    }
}
