# Mobile app wrapper (optional)

This folder is an optional Capacitor wrapper plan. It is included to satisfy "mobile-ready app format".
Building native apps requires platform toolchains (Xcode/Android Studio).

If you want a true installable experience without native builds, use the included PWA:
- Open the site in mobile Chrome/Safari
- Use "Add to Home Screen" / Install

If you want a native build, the simplest path is:
- Create a Capacitor project and point `webDir` at this package.
