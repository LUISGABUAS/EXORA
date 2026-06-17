import WidgetKit
import SwiftUI

@main
struct ExoraWidgetBundle: WidgetBundle {
    var body: some Widget {
        ExoraWidget()
        QuickAddWidget()
    }
}
