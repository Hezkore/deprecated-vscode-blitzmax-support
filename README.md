# [BlitzMax](https://blitzmax.org/) Language Basics for [Visual Studio Code](https://code.visualstudio.com/)

[![Version](https://vsmarketplacebadge.apphb.com/version/hezkore.BlitzMax.svg)](https://marketplace.visualstudio.com/items?itemName=hezkore.Blitzmax)
[![Installs](https://vsmarketplacebadge.apphb.com/installs-short/hezkore.BlitzMax.svg)](https://marketplace.visualstudio.com/items?itemName=hezkore.BlitzMax)

Provides snippets, syntax highlighting, bracket matching and folding in [BlitzMax](https://blitzmax.org/) files.

![Preview](https://github.com/Hezkore/vscode-blitzmax-support/raw/master/./media/demo.png)

## Features
* Syntax highlighting for BlitzMax [NG](https://blitzmax.org/) and [Legacy](https://nitrologic.itch.io/blitzmax/).
* Build Tasks for Console, Gui, Lib and Mods.
* Problem Matcher.
* Module Auto Complete.
* View BlitzMax examples.
* View Module Definitions.
* Quick Build Buttons.
* Snippets.

## Changelog
Read [CHANGELOG](https://marketplace.visualstudio.com/items/Hezkore.blitzmax/changelog).

## Troubleshooting
* **Q. I got a warning message.**\
`*Notice* task.json output is NOT supported on this version of BlitzMax`
* **A. This is not a problem.**\
BlitzMax Legacy and BlitzMax NG bmk versions lower than 3.39 do not create the output folder while compiling.
Your compiled binary files will be placed inside your source folder -- just like with MaxIDE -- instead of following the 'ouput' path you've manually set in `tasks.json`.\
Read more about Tasks [here](https://code.visualstudio.com/docs/editor/tasks).
</br></br>
* **Q. I'm seeing the same item in the Auto Complete list twice.**\
Whenever I type something, for example `Print`; I'm seeing `Print` twice in the Auto Complete list.
* **A. This seems to be a rare bug.**\
Just open the Command Palette by pressing `Ctrl+Shift+P` and type `Generate Documentations` to refresh the list.
</br></br>
* **Q. My problem is not listed here.**\
I have a question or problem that is not listed in the troubleshooting section.
* **A. We'll figure it out.**\
For questions you can always contact me on Telegram [@Hezkore](https://t.me/Hezkore).\
Use the GitHub issues page for everything else, which you can find [here](https://github.com/Hezkore/vscode-blitzmax-support/issues).

## Credits
[BlitzMax](https://nitrologic.itch.io/blitzmax/) by [Mark Sibly](https://github.com/blitz-research).\
[BlitzMax NG](https://blitzmax.org/) by [Brucey](https://github.com/woollybah).\
Extension by [Hezkore](https://github.com/Hezkore).\
Icons by [GWRon](https://github.com/GWRon).


## Contributing
Contributions are greatly appreciated.\
Fork this repository and open your pull requests.

## License
Licensed under the [MIT](https://github.com/Hezkore/vscode-blitzmax-support/blob/master/LICENSE.md) License.