# BlitzMax Language Basics CHANGELOG

## Version 1.24.1
* Fixed a spelling error.
* Better error reporting.
* Aborting input fields no longer clears build options.
* New task reveal setting (On Problem, Always, Never).
* Task is now echoed by default.

## Version 1.24.0
* Fixed an issue when saving workspace task settings.
* Fixed an issue when using the Build button.
* New unique BlitzMax view container.
* Build Options added to view container.
* New 'toggleBuildOption' command.

## Version 1.23.0
* New simpler task/build system.
* Better explanation of Run and Build buttons.
* Better detection of function names.

## Version 1.22.1
* Certain control keywords should now correctly highlight on all themes.

## Version 1.22.0
* Added support for using a custom appstub.

## Version 1.21.2
* Updated snippets.
* Fixed an issue where `End Extern` was incorrectly highlighted.

## Version 1.21.1
* Updated document formater.

## Version 1.21.0
* Updated snippets for Type, Function and Method.
* Better document formatting and bug fixes.
* Support for metadata.

## Version 1.20.0
* New BlitzMax NG versions will be searched for at startup.
* New 'Check for BlitzMax NG Updates' command.
* New option to disable checking for updates at startup.

## Version 1.19.5
* Stricter rules for debug builds.

## Version 1.19.4
* Better error reports when setting source file.
* F5/F6 shortcuts should now work globally.

## Version 1.19.3
* Better error reports.

## Version 1.19.2
* Stricter rules while initializing BlitzMax.

## Version 1.19.1
* Better BlitzMax path detection.

## Version 1.19.0
* Better troubleshooting.
* Updated snippet for Type.

## Version 1.18.0
* 'Generate BlitzMax Project' is now reached from the Explorer view.
* Debug with no 'output' will create a '.debug' binary.

## Version 1.17.0
* Basic outline support implemented.

## Version 1.16.1
* Better error notifications.
* More signature help triggers.

## Version 1.16.0
* Output view is no longer shown at extension startup.
* New progress information at the bottom of the window.

## Version 1.15.0
* Fix for task output not setting correctly.
* < and > are no longer considered to be "brackets".
* Document formatting implemented.

## Version 1.14.0
* Task output is no longer automatically set, unless selected in options.

## Version 1.13.0
* New 'Generate Project' command.

## Version 1.12.1
* Fix for modules with no entry point.

## Version 1.12.0
* More errors will be displayed while updating modules.
* The application template will now use a framework instead of import.
* Fixed several code analyzer issues related to 'Move / Run Selected Text'.
* Some minor code diagnostics along with quick fix actions have been implemented.

## Version 1.11.0
* Added template snippets for application, module and MaxGUI.
* Better indentation for Select cases.
* $BLOCK_COMMENT_START / END in snippets is now supported.
* New 'Move Selected Text To Own File' feature.
* 'Run Selected Text' no longer uses templates and instead analyzes the current file.
* 'Build Application' button will now actually Build the application instead of configuring it.

## Version 1.10.6
* Better Linux support.

## Version 1.10.5
* Extension now detects BlitzMax bmk version.
* Fixed task issues on older BlitzMax versions.

## Version 1.10.4
* Extension now detects BlitzMax bcc version.

## Version 1.10.3
* Older BlitzMax versions will no longer produce errors when output path is set.
* Fixed typos.
* Better help for setting up extension.

## Version 1.10.2
* Better indentation rules.
* Output channel will not longer steal focus.

## Version 1.10.1
* Extension will now use its own output channel.

## Version 1.10.0
* New 'Run Selected Text' feature.

## Version 1.9.1
* Updated extension description.

## Version 1.9.0
* New 'bin' build path.
* Added support for ${platform}, ${arch} and ${build} variable substitution.

## Version 1.8.62
* Better problem highlighting.

## Version 1.8.61
* Simple workaround for background tasks.

## Version 1.8.6
* Added GDB task flag.

## Version 1.8.5
* F6 will now rerun the last task.

## Version 1.8.4
* Document scanner now scans 'includes'.

## Version 1.8.3
* Added bbdoc snippets.

## Version 1.8.2
* Fixed quick builds not being console debug apps.
* Setting a source file will now also try to set output as well.

## Version 1.8.1
* Better variable substitution (see: https://code.visualstudio.com/docs/editor/variables-reference )
* Updated default tasks.

## Version 1.8.0
* Build related options has been moved into tasks.json.

## Version 1.7.14
* BMK absolute path is now used instead of PATH.

## Version 1.7.13
* Cleaner build command.
* Snippets are no longer always at the top of suggestion list.
* Debug builds will now always execute the app, while build tasks do not.
* Option for verbose (noisy) build.

## Version 1.7.12
* New 'Generate Documentations' command.
* Better auto-update for modules.

## Version 1.7.11
* Better auto-complete for Method and Function.

## Version 1.7.10
* Fixed initial module building.

## Version 1.7.9
* Better Type Tag Shortcut documentation.
* Functions and Methods now show return type.

## Version 1.7.8
* Better Type, Struct and Interface documentation.
* "Go to Definition" will now scan deeper if no result was initially found.

## Version 1.7.7
* Updated snippets.
* Better conditional compiling detection.

## Version 1.7.6
* Function name detection now support Arrays.

## Version 1.7.5
* Updated snippets.

# Version 1.7.4
* Fixed a "Go to Definition" error.

# Version 1.7.3
* Keywords no longer include quotation marks.

# Version 1.7.2
* More snippets updates.

## Version 1.7.1
* Updated snippets.

## Version 1.7.0
* New custom documentations scanner.
* Hover tips.
* Signature help provider.
* Lots of other small improvments.

## Version 1.6.4
* Fixed a bcc typo.

## Version 1.6.3
* Better help for setting BlitzMax path.
* Folding is now always shown by default.

## Version 1.6.2
* Fixed 'Platform' parameter typo.
* New dialog asking to rebuild docs.

## Version 1.6.1
* New 'auto' option for 'Architecture' and 'Platform'.

## Version 1.6.0
* New 'Build Docs' command.
* New 'Architecture' and 'Platform' build options.

## Version 1.5.0
* Module commands are now added and auto-corrected.
* Much better indentation rules.

## Version 1.4.7
* Fixed a 'path' typo.

## Version 1.4.6
* Env 'path' is now used for bcc and BMK. Should fix some path issues.

## Version 1.4.5
* Made snippets even less annyoing.

## Version 1.4.4
* BlitzMax Legacy and NG detection. Should fix some compile issues.

## Version 1.4.3
* Fixed an issue with workspace sub-folder .bmx compiling.

## Version 1.4.2
* Made snippets less annyoing.

## Version 1.4.1
* Spaces in path now works correctly.

## Version 1.4.0
* Added editor buttons for quick build and task build.

## Version 1.3.0
* You can now right click a .bmx tab or file in the explorer to set as workspace source file.
* Fixed a bug where pressing F5 didn't detect your active .bmx file.

## Version 1.2.0
* Squashed bugs.
* The workspace source file is no longer automatically set.
* New 'SetSourceFile' command for settings workspace source file.
* You can now press F5 to quickly build and execute your application.

## Version 1.1.0
* Working build tasks.

## Version 1.0.0
* Initial release.