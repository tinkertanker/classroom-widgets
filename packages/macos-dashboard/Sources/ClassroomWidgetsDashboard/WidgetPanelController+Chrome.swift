import AppKit

/// The panel's title bar chrome: its accessory buttons and menus, and the
/// hover tracking that reveals and hides them.
extension WidgetPanelController {
    func addCompactAccessories(to panel: NSPanel) {
        let volumeButton = NSButton(
            image: volumeButtonImage,
            target: self,
            action: #selector(showOutputVolumeMenu(_:))
        )
        volumeButton.bezelStyle = .texturedRounded
        volumeButton.controlSize = .small
        volumeButton.imagePosition = .imageOnly
        volumeButton.toolTip = "Output volume"
        self.volumeButton = volumeButton
        updateVolumeButton()

        let addButton = NSButton(
            image: NSImage(systemSymbolName: "plus", accessibilityDescription: "Add widget") ?? NSImage(),
            target: self,
            action: #selector(showAddWidgetMenu(_:))
        )
        addButton.bezelStyle = .texturedRounded
        addButton.controlSize = .small
        addButton.imagePosition = .imageOnly
        addButton.toolTip = "Add widget"

        let arrangeButton = NSButton(
            image: NSImage(systemSymbolName: "square.grid.2x2", accessibilityDescription: "Arrange widgets") ?? NSImage(),
            target: self,
            action: #selector(showArrangeWidgetsMenu(_:))
        )
        arrangeButton.bezelStyle = .texturedRounded
        arrangeButton.controlSize = .small
        arrangeButton.imagePosition = .imageOnly
        arrangeButton.toolTip = "Arrange widgets"

        let controls = NSStackView(views: [volumeButton, addButton, arrangeButton])
        controls.orientation = .horizontal
        controls.alignment = .centerY
        controls.spacing = 6
        controls.frame.size = controls.fittingSize
        let accessory = NSTitlebarAccessoryViewController()
        accessory.view = controls
        accessory.layoutAttribute = .right
        panel.addTitlebarAccessoryViewController(accessory)
        compactControls = controls
    }

    func installChromeTracking(on panel: NSPanel) {
        guard let frameView = panel.contentView?.superview else { return }
        if let titlebarView = panel.standardWindowButton(.closeButton)?.superview {
            chromeBackground.material = .headerView
            // The clear panel has no content beneath its title bar to blend with.
            chromeBackground.blendingMode = .behindWindow
            chromeBackground.state = .active
            chromeBackground.wantsLayer = true
            chromeBackground.layer?.cornerRadius = 10
            chromeBackground.layer?.cornerCurve = .continuous
            chromeBackground.layer?.masksToBounds = true
            chromeBackground.setAccessibilityElement(false)
            chromeBackground.frame = titlebarView.bounds
            chromeBackground.autoresizingMask = [.width, .height]
            titlebarView.addSubview(chromeBackground, positioned: .below, relativeTo: nil)
        }
        chromeTrackingView = frameView
        updateChromeTrackingArea()
    }

    private func updateChromeTrackingArea() {
        guard let frameView = chromeTrackingView else { return }
        if let chromeTrackingArea {
            frameView.removeTrackingArea(chromeTrackingArea)
        }
        let area = NSTrackingArea(
            rect: .zero,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        frameView.addTrackingArea(area)
        chromeTrackingArea = area
    }

    func revealChrome() {
        chromeHideGeneration += 1
        setChromeVisible(true)
    }

    func scheduleChromeHide() {
        chromeHideGeneration += 1
        let generation = chromeHideGeneration
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            guard let self,
                  self.chromeHideGeneration == generation,
                  !self.pointerIsInPanel
            else { return }
            self.setChromeVisible(false)
        }
    }

    private var pointerIsInPanel: Bool {
        guard let panel = window, panel.isVisible else { return false }
        return panel.frame.contains(NSEvent.mouseLocation)
    }

    private func setChromeVisible(_ visible: Bool) {
        guard let panel = window else { return }
        let effectiveVisibility = visible || NSWorkspace.shared.isVoiceOverEnabled
        guard chromeVisible != effectiveVisibility else { return }
        chromeVisible = effectiveVisibility
        setWebChromeVisibility()
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true

        let views: [NSView] = standardWindowButtons(in: panel).map { $0 as NSView }
            + [compactControls].compactMap { $0 }
            + [chromeBackground]
        views.forEach { $0.isHidden = false }
        let targetAlpha: CGFloat = effectiveVisibility ? 1 : 0
        if NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
            views.forEach { $0.alphaValue = targetAlpha }
        } else {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.16
                views.forEach { $0.animator().alphaValue = targetAlpha }
            }
        }

        guard !effectiveVisibility else { return }
        let generation = chromeHideGeneration
        Task { @MainActor [weak self] in
            if !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
                try? await Task.sleep(nanoseconds: 170_000_000)
            }
            guard let self,
                  self.chromeHideGeneration == generation,
                  !self.chromeVisible
            else { return }
            views.forEach { $0.isHidden = true }
        }
    }

    private func standardWindowButtons(in panel: NSWindow) -> [NSButton] {
        [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton]
            .compactMap { panel.standardWindowButton($0) }
    }

    @objc private func showOutputVolumeMenu(_ sender: NSButton) {
        let volume = UserDefaults.standard.double(forKey: DashboardSettingKeys.outputVolume)
        let menu = NSMenu(title: "Output Volume")
        for preset in DashboardAudioSettings.presets {
            let item = NSMenuItem(title: preset.label, action: #selector(setOutputVolume(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = preset.volume
            item.state = volume == preset.volume ? .on : .off
            menu.addItem(item)
        }
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.maxY + 4), in: sender)
    }

    @objc private func setOutputVolume(_ sender: NSMenuItem) {
        guard let volume = sender.representedObject as? Double else { return }
        onOutputVolumeChanged?(volume)
    }

    private var volumeButtonImage: NSImage {
        let volume = UserDefaults.standard.double(forKey: DashboardSettingKeys.outputVolume)
        let symbol = volume == 0 ? "speaker.slash.fill" : volume < 0.5 ? "speaker.wave.1.fill" : "speaker.wave.2.fill"
        return NSImage(systemSymbolName: symbol, accessibilityDescription: "Output volume") ?? NSImage()
    }

    func updateVolumeButton() {
        volumeButton?.image = volumeButtonImage
        let volume = UserDefaults.standard.double(forKey: DashboardSettingKeys.outputVolume)
        let label = "Output volume: \(DashboardAudioSettings.label(for: volume))"
        volumeButton?.toolTip = label
        volumeButton?.setAccessibilityLabel(label)
    }

    @objc private func showAddWidgetMenu(_ sender: NSButton) {
        let menu = WidgetMenu.makePanelMenu(
            options: widgetCreationOptions,
            target: self,
            displayAction: #selector(requestDisplayPreview),
            widgetAction: #selector(requestWidgetCreation(_:))
        )
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.maxY + 4), in: sender)
    }

    @objc private func requestWidgetCreation(_ sender: NSMenuItem) {
        onWidgetCreationRequested?(sender.tag)
    }

    @objc private func requestDisplayPreview() { onDisplayPreviewRequested?() }

    @objc private func showArrangeWidgetsMenu(_ sender: NSButton) {
        let menu = NSMenu(title: "Arrange Widgets")
        let layouts: [(title: String, layout: WidgetPanelLayout)] = [
            ("Freeform", .freeform),
            ("Arrange in Row", .row),
            ("Arrange in Column", .column)
        ]
        for itemLayout in layouts where hasMultipleVisiblePanels() {
            let item = NSMenuItem(title: itemLayout.title, action: #selector(requestLayout(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = itemLayout.layout.rawValue
            menu.addItem(item)
        }
        addSnapItems(to: menu)
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.maxY + 4), in: sender)
    }

    /// Position presets for this widget alone, below the layouts that move every widget.
    func addSnapItems(to menu: NSMenu) {
        if !menu.items.isEmpty { menu.addItem(.separator()) }
        let header = NSMenuItem(title: "Move This Widget", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)
        for (index, group) in WindowSnapPreset.groups.enumerated() {
            if index > 0 { menu.addItem(.separator()) }
            for preset in group {
                let item = NSMenuItem(title: preset.title, action: #selector(requestSnap(_:)), keyEquivalent: "")
                item.target = self
                item.representedObject = preset.rawValue
                menu.addItem(item)
            }
        }
    }

    @objc private func requestSnap(_ sender: NSMenuItem) {
        guard let raw = sender.representedObject as? String, let preset = WindowSnapPreset(rawValue: raw) else { return }
        onSnapRequested?(preset)
    }

    @objc private func requestLayout(_ sender: NSMenuItem) {
        guard let rawLayout = sender.representedObject as? String,
              let layout = WidgetPanelLayout(rawValue: rawLayout)
        else { return }
        onLayoutRequested?(layout)
    }
}
