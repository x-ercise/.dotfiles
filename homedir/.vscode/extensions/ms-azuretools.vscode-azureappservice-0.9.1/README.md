# Azure App Service for Visual Studio Code (Preview)

[![Version](https://vsmarketplacebadge.apphb.com/version/ms-azuretools.vscode-azureappservice.svg)](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azureappservice) [![Installs](https://vsmarketplacebadge.apphb.com/installs-short/ms-azuretools.vscode-azureappservice.svg)](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azureappservice) [![Build Status](https://travis-ci.org/Microsoft/vscode-azureappservice.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-azureappservice)

App Service is Azure's fully-managed Platform as a Service (PaaS) that let's you deploy and scale web, mobile, and API apps. Use the Azure App Service extension for VS Code to quickly create, manage, and deploy your websites.

Check out this [deployment tutorial](https://code.visualstudio.com/tutorials/app-service-extension/getting-started) to get started with deploying a Node.js Express app to Azure App Service on Linux.

## Features

* Create new web apps/deployment slots
* Deploy to your web apps/deployment slots
* Stream your logs to VS Code's output window
* Add and edit environment variables (app settings)
* Browse sites across all of your Azure subscriptions
* Browse to the Azure Portal for advanced tasks, such as scaling

![Deploy to Web App](https://github.com/Microsoft/vscode-azureappservice/raw/master/resources/WebApp_Deploy.png)

* Start, stop, and restart the web app/deployment slot
* Swap deployment slots
* View and edit web app settings
* View web app log stream
* View and edit a web app's remote files
  * To view a file, click on it in the explorer.
  * To edit, make edits in the editor and save it.  When prompted to upload the file, click 'Upload'.
  * CAUTION: Manually editing your Web App's files could cause unexpected behavior.
* View a web app's log files

![Web App Log Stream](https://github.com/Microsoft/vscode-azureappservice/raw/master/resources/WebApp_LogStream.png)

## Configuring Zip Deploy

* How to configure zip deployment:
  * If you set the deployment source of your web app to “None” (the default source on app creation), the deploy command will Zip the contents of a selected folder and upload the Zip file to Azure.

  * VS Code will prompt on deploy if you would like to configure your project for faster deployment.  If you click 'Yes', the following changes will be made in your project:
    * The vscode setting `appService.zipIgnorePattern` is changed to indicate that build artifacts will not be zipped and deployed.  These will be built on the server by running the appropriate build command.
    * A '.deployment' file will be created in the root of the project.  This file configures `SCM_DO_BUILD_DURING_DEPLOYMENT=true` enabling build on deploy.
      > NOTE: Currently only 'node' runtimes support this feature.
  * If you select 'Never show again,' the `appService.showBuildDuringDeployPrompt` vscode setting will be set to `false` and you will no longer be prompted for this project.  Delete this setting or set it to `true` to re-enable the prompt.

### Zip Deploy Configuration Settings

* `appService.zipGlobPattern`
  * Uses a glob pattern to define which files to be included in the deployment. The default value is '**/*'.

* `appService.zipIgnorePattern`
  * Uses a glob pattern to define which files to be excluded from the deployment. The default value is [] which doesn’t exclude any files/folders.

* For example, you might want to exclude the 'node_modules' folder from the deployment to speed up the Zip file creation and uploading. In this case, you will need the following setting:
  * `"appService.zipIgnorePattern: ['node_modules{,/**}']"`
  * And in order to have the web app run the proper deployment command to install the npm packages, you need to have the following Application Setting on your site or in a '.deployment' file at the root of your repo:
    * `SCM_DO_BUILD_DURING_DEPLOYMENT=true`

    ![Web App Log Stream](https://github.com/Microsoft/vscode-azureappservice/raw/master/resources/Scm_Do_Build_During_Deployment.png)

## Advanced Creation Configuration Settings

* `appService.advancedCreation`
  * Enables full control for `Create New Web App...`.  Set this to `true` to explicitly control more settings (i.e. App Service plan size) when creating web apps rather than using the defaults.

## Preview Features

* Remote debugging for Node.js apps running on Linux
  * To enable this feature, click File > Preferences > Settings. modify your `appService.enableRemoteDebugging` to be true.
  * Right-click a web application on the explorer and it will be on the context menu.  (This feature currently only works for Node.js apps running on Linux)

## Managing Azure Subscriptions

If you are not signed in to Azure, you will see a "Sign in to Azure..." link. Alternatively, you can select "View->Command Palette" in the VS Code menu, and search for "Azure: Sign In".

![Sign in to Azure](https://github.com/Microsoft/vscode-azureappservice/raw/master/resources/SignInScreenshot.png)

If you don't have an Azure Account, you can sign up for one today for free and receive $200 in credits by selecting "Create a Free Azure Account..." or selecting "View->Command Palette" and searching for "Azure: Create an Account".

You may sign out of Azure by selecting "View->Command Palette" and searching for "Azure: Sign Out".

To select which subscriptions show up in the extension's explorer, click on the "Select Subscriptions..." button on any subscription node (indicated by a "filter" icon when you hover over it), or select "View->Command Palette" and search for "Azure: Select Subscriptions". Note that this selection affects all VS Code extensions that support the [Azure Account and Sign-In](https://github.com/Microsoft/vscode-azure-account) extension.

![Select Azure Subscriptions](https://github.com/Microsoft/vscode-azureappservice/raw/master/resources/SelectSubscriptionsScreenshot.png)

## Known Issues

* Local Git deployment may fail with large commits

## Requirements

All you need is an Azure Subscription to get started. If you don't have one, [click here](https://azure.microsoft.com/en-us/free/) for a free subscription with $200 in Azure credits!

## Contributing

There are a couple of ways you can contribute to this repo:

* **Ideas, feature requests and bugs**: We are open to all ideas and we want to get rid of bugs! Use the Issues section to either report a new issue, provide your ideas or contribute to existing threads.
* **Documentation**: Found a typo or strangely worded sentences? Submit a PR!
* **Code**: Contribute bug fixes, features or design changes:
  * Clone the repository locally and open in VS Code.
  * Install [TSLint for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=eg2.tslint).
  * Open the terminal (press `` CTRL+` ``) and run `npm install`.
  * To build, press `F1` and type in `Tasks: Run Build Task`.
  * Debug: press `F5` to start debugging the extension.

### Legal

Before we can accept your pull request you will need to sign a **Contribution License Agreement**. All you need to do is to submit a pull request, then the PR will get appropriately labelled (e.g. `cla-required`, `cla-norequired`, `cla-signed`, `cla-already-signed`). If you already signed the agreement we will continue with reviewing the PR, otherwise system will tell you how you can sign the CLA. Once you sign the CLA all future PR's will be labeled as `cla-signed`.

### Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](https://github.com/Microsoft/vscode-azureappservice/blob/master/mailto:opencode@microsoft.com) with any additional questions or comments.

## Telemetry

VS Code collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://go.microsoft.com/fwlink/?LinkID=528096&clcid=0x409) to learn more. If you don’t wish to send usage data to Microsoft, you can set the `telemetry.enableTelemetry` setting to `false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

## License

[MIT](https://github.com/Microsoft/vscode-azureappservice/blob/master/LICENSE.md)
