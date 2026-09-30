# Khata — installed app build

The app in `www/index.html` works on its own in any browser. Building it into an
installed Android app buys three things a browser will not give a local file:

- **Your phone contacts.** The app reads the address book directly.
- **Sharing bills and statements into WhatsApp** as attachments, not saved files.
- A home screen icon, no address bar, and no chance of a browser tab being cleared.

## Route 1 — no build at all, no tooling

Put the contents of `www/` on any https address. A GitHub Pages repo works, so does
dragging the folder onto Netlify Drop or Cloudflare Pages. Then on the phone, open the
address in Chrome and use **Add to home screen**.

You get an icon, a full screen with no address bar, and the app works with no signal
because `sw.js` caches it on first open. More to the point, it now runs from https,
which is what switches on the phone's contact picker and handing bills straight to
WhatsApp. Upload all of `www/` — the manifest, the service worker and the icons have
to sit beside `index.html`.

This is the whole feature set apart from reading the address book in one sweep. Try it
before building anything.

## Route 2 — an APK without installing anything

`.github/workflows/build-apk.yml` builds it on GitHub's machines.

1. Put this folder in a GitHub repository.
2. Open the **Actions** tab. The build starts on its own; give it five minutes.
3. Open the finished run, and under **Artifacts** download **khata-apk**.
4. Unzip, and `app-debug.apk` is inside.

No Node, no Java, no SDK, no Android Studio on your side. If the repo is already
pushed, you can do all of this from a phone browser.

## Route 3 — an APK from the hosted site, in a browser

If you did Route 1, [PWABuilder](https://www.pwabuilder.com) takes the address and
hands back a signed Android package, again with nothing installed locally. It wraps the
hosted site rather than bundling it, so the phone needs signal the first time it opens,
and it asks you to upload one small `assetlinks.json` file to the host to prove the
site is yours. Contacts work through the phone's picker in this build, not the native
plugin.

## Route 4 — building locally, command line only

Android Studio is not required; it only bundles what the command line tools give you
in about a tenth of the download. You need Node.js, a JDK 17, and the Android
command line tools.

```bash
# JDK 17
sudo apt install openjdk-17-jdk          # macOS: brew install openjdk@17

# Android command line tools: download the "Command line tools only" zip from
# https://developer.android.com/studio#command-line-tools-only
mkdir -p ~/android/cmdline-tools
cd ~/android/cmdline-tools
unzip ~/Downloads/commandlinetools-*.zip
mv cmdline-tools latest

export ANDROID_HOME="$HOME/android"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

Put those two `export` lines in your `~/.bashrc` or `~/.zshrc` so they survive a new
terminal. Then:

```bash
cd khata-android
npm install
npx cap add android        # creates android/; only needed once
npx cap sync
cd android
./gradlew assembleDebug    # Windows: gradlew.bat assembleDebug
```

The APK lands at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

The first build downloads Gradle and can take ten minutes. Later builds are under a
minute. `npx cap sync` after every edit to `www/index.html`.

If Gradle complains about a Java version, check `java -version` reports 17 — a
newer JDK on the path is the usual cause, and `export JAVA_HOME` pointing at 17
fixes it.

## Putting the APK on a phone

Copy the file to the phone however you like — cable, or upload it somewhere and
download it. Tap it. Android will say installing from this source is not allowed;
the prompt links straight to the setting to allow it for whichever app is doing the
installing (Files, Chrome, WhatsApp). Allow it, go back, tap the APK again.

Google Play Protect may warn that the app is unrecognised. That is expected for an APK
that did not come from the Play Store, and **Install anyway** proceeds.

## Signing, for giving the app to other people

A debug APK is fine on your own phone. Anything you hand out should be a signed
release, otherwise it cannot be updated cleanly later.

```bash
keytool -genkey -v -keystore khata.jks -keyalg RSA \
  -keysize 2048 -validity 10000 -alias khata
```

`keytool` comes with the JDK, so this needs no Android tooling. Answer the questions,
and keep both the `.jks` file and its passwords safe — every future update must be
signed with the same keystore, and there is no way to recover a lost one.

Then build a release and sign it in one command:

```bash
cd android
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=$PWD/../khata.jks \
  -Pandroid.injected.signing.store.password=YOUR_PASSWORD \
  -Pandroid.injected.signing.key.alias=khata \
  -Pandroid.injected.signing.key.password=YOUR_PASSWORD
```

The signed file appears at
`android/app/build/outputs/apk/release/app-release.apk`.

To do the same in the GitHub workflow, store the keystore as a base64 secret, decode
it in a step before the build, and pass the same four properties from secrets.

## Permissions

`@capacitor-community/contacts` declares `READ_CONTACTS` itself, and the manifest
merge picks it up, so there is nothing to add by hand. Android asks the shopkeeper
for permission the first time they tap **Add from contacts** — the app requests it at
that moment, not at install.

If a build complains the permission is missing, add it to
`android/app/src/main/AndroidManifest.xml` above the `<application>` tag:

```xml
<uses-permission android:name="android.permission.READ_CONTACTS" />
```

## After you change the app

`www/index.html` is the whole app, one file. Edit it, then:

```bash
npx cap sync
```

and rebuild. Nothing else references it.

## How the app finds your contacts

`index.html` tries three routes in order and uses the first that works, so the same
file is correct in all three situations:

1. `Capacitor.Plugins.Contacts` — present only in the installed app. Reads the
   address book, then shows a searchable tick list.
2. `navigator.contacts.select` — the phone's own picker, available to https pages.
   You choose people in the phone's UI and they come back to the tick list.
3. A `.vcf` file shared out of the Contacts app, or a pasted list of names.

## Versions

The versions in `package.json` are a starting point. If `npm install` objects,
`npx cap doctor` reports what mismatches, and bumping all four `@capacitor/*` and
`@capacitor-community/contacts` entries to their current major together usually
settles it. The plugin's return shape is read defensively in `index.html`, so a
newer major should still work.
