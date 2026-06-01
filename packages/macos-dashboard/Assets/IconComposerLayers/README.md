# Classroom Widgets Icon Layers

This folder contains Icon Composer-ready source layers for the app icon.
The current mark is a simple four-shape layout: circle + taller rectangle,
shorter rectangle + square.

The repo also includes `../ClassroomWidgets.icon`, a valid Icon Composer package.
Open that file in Icon Composer if you want to tune Liquid Glass settings.

If you want to rebuild the package manually, set the Icon Composer fill to dark
ink and import the PNG layers in this order:

1. `01-background.png`
2. `03-widgets.png`

The flattened app icon used by the SwiftPM app bundle is generated from the same geometry at `../AppIconSource.png`, then packed into `Sources/ClassroomWidgetsDashboard/Resources/AppIcon.icns`.
