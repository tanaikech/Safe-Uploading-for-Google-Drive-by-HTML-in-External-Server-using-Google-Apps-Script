<a name="top"></a>

# Safe-Uploading for Google Drive by HTML in External Server using Google Apps Script

<a name="overview"></a>

# Overview

**This is a report for safe-uploading files to Google Drive by HTML put in the external server using Google Apps Script.**

<a name="description"></a>

# Description

When you want to make the user upload a file to your own Google Drive using the HTML put in the external server of Google side, when the file size is smaller than 50 MB, this can be achieved without using the access token. [Ref](https://tanaikech.github.io/2020/08/13/uploading-file-to-google-drive-from-external-html-without-authorization/) (When the HTML is put in the internal server of Google side, you can also use [`google.script.run`](https://tanaikech.github.io/2020/02/18/uploading-file-to-google-drive-using-html-and-google-apps-script/).) But, when the file size is over 50 MB, it is required to upload the file with the resumable upload. In this case, the access token is required to be used. In this case that the user uploads to your own Google Drive, when the access token is used in the upload, it is considered that this is the weak point of the security. In this report, I would like to propose the method for safe-uploading files to Google Drive by HTML put in the external server using Google Apps Script. Please think of this as one of several methods.

![](images/fig1.png)

# Flow

The flow of this method is as follows.

1. When an user access to the Web Apps and select a file for uploading from the user's local PC, the script of Web Apps is run.

2. Retrieve the access token and folder ID of destination folder (`temp` folder) to the client side.

3. Using the access token and folder ID, the file is uploaded with the resumable upload.

   - The script and javascript library for the resumable upload uses the repository of [ResumableUploadForGoogleDrive_js](https://github.com/tanaikech/ResumableUploadForGoogleDrive_js).

4. When the file upload is finished, at the Web Apps side, the uploaded file is copied to the specific folder (`dest` folder) and the original file is removed. By this, the owner of the file is changed from the service account to your account. By this, the access token from the Web Apps cannot see the uploaded file.

# Usage

## 1. Create service account.

This method uses the service account. So please create the service account. You can see the method for creating the service account as follows.

- [Creating and managing service accounts](https://cloud.google.com/iam/docs/creating-managing-service-accounts?hl=en)
- [Create a service account](https://support.google.com/a/answer/7378726?hl=en)

When you create the service account, please retrieve the credential file as the JSON file. The credential data is used in this method.

## 2. Create new folders.

1. Please create 2 new folders. For example, please set the folder names like `temp` and `dest`. One is used for the temporal folder. Another is used for the destination folder of the uploaded file.

2. Please share `temp` folder with the email address of the service account as the writer. By this, the service account can access to the folder. The folder `dest` is NOT required to be shared.

## 3. Create new project of Google Apps Script.

This Web Apps is created by Google Apps Script. So please create new Google Apps Script project.

If you want to directly create it, please access to [https://script.new/](https://script.new/). In this case, if you are not logged in Google, the log in screen is opened. So please log in to Google. By this, the script editor of Google Apps Script is opened.

## 4. Prepare Web Apps side. (server side)

Please copy and paste the following script (Google Apps Script) to the script editor. This script is for the Web Apps. This Web Apps is used as an API.

And, please set the variables of `folderId` and `dstFolderId` in `doGet`, and `private_key` and `client_email` in `getAccessTokenFromServiceAccount`.

And also, [please enable Drive API at Advanced Google services](https://developers.google.com/apps-script/guides/services/advanced#enable_advanced_services).

```javascript
function doGet(e) {
  const tempFolderId = "###"; // Please set the folder ID of folder shared with the service account.
  const destFolderId = "###"; // Please set the destination folder for the uploaded file.

  const accessKey = "sampleKey"; // This is used as the API key for using of this script.

  const key = e.parameter.key;
  if (key && key == accessKey) {
    const work = e.parameter.work;
    if (work && work == "start") {
      const scopes = ["https://www.googleapis.com/auth/drive.file"];
      const accessToken = getAccessTokenFromServiceAccount(scopes);
      const resValue = Utilities.base64Encode(
        JSON.stringify({ accessToken: accessToken, folderId: tempFolderId })
      );
      return ContentService.createTextOutput(resValue).setMimeType(
        ContentService.MimeType.TEXT
      );
    } else if (work && work == "end") {
      const fileId = e.parameter.fileId;
      const params1 = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ parents: [destFolderId] }),
        headers: { authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
      };
      UrlFetchApp.fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/copy`,
        params1
      );
      const scopes = ["https://www.googleapis.com/auth/drive"];
      const accessToken = getAccessTokenFromServiceAccount(scopes);
      const params2 = {
        method: "delete",
        headers: { authorization: `Bearer ${accessToken}` },
      };
      UrlFetchApp.fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        params2
      );
      return ContentService.createTextOutput("Done.").setMimeType(
        ContentService.MimeType.TEXT
      );
    }
  }
  return ContentService.createTextOutput("Error.").setMimeType(
    ContentService.MimeType.TEXT
  );

  // DriveApp.createFile()  // This is used for automatically detecting the scope of "https://www.googleapis.com/auth/drive". This scope is used for copying file.
}

// This function is used for retrieving the access token from the service account.
// This script is from https://tanaikech.github.io/2018/12/07/retrieving-access-token-for-service-account-using-google-apps-script/
function getAccessTokenFromServiceAccount(scopes) {
  const private_key =
    "-----BEGIN PRIVATE KEY-----\n###your provate key###-----END PRIVATE KEY-----\n"; // private_key of JSON file retrieved by creating Service Account
  const client_email = "###"; // client_email of JSON file retrieved by creating Service Account

  const url = "https://www.googleapis.com/oauth2/v4/token";
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: client_email,
    scope: scopes.join(" "),
    aud: url,
    exp: (now + 3600).toString(),
    iat: now.toString(),
  };
  const signature =
    Utilities.base64Encode(JSON.stringify(header)) +
    "." +
    Utilities.base64Encode(JSON.stringify(claim));
  const jwt =
    signature +
    "." +
    Utilities.base64Encode(
      Utilities.computeRsaSha256Signature(signature, private_key)
    );
  const params = {
    method: "post",
    payload: {
      assertion: jwt,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    },
  };
  const data = UrlFetchApp.fetch(url, params).getContentText();
  const obj = JSON.parse(data);
  return obj.access_token;
}
```

Above script can be also seen by `serverSide.gs`.

## 5. Deploy Web Apps.

Here, the Web Apps is deployed.

1. On the script editor, Open a dialog box by "Publish" -> "Deploy as web app".

   - You can see this for "Legacy editor" and "New editor" at [official document](https://developers.google.com/apps-script/guides/web#deploy_a_script_as_a_web_app).

2. Select **"Me"** for **"Execute the app as:"** on "Legacy editor" and **"Execute as:** on "New editor".

   - By this, the script is run as the owner.

3. Select **"Anyone, even anonymous"** for **"Who has access to the app:"** on "Legacy editor" and **"Anyone"** on "New editor".

   - At the client and server side, the access key is used for executing the script.

4. Click "Deploy" button as new "Project version".

5. Automatically open a dialog box of "Authorization required".

   1. Click "Review Permissions".
   2. Select own account.
   3. Click "Advanced" at "This app isn't verified".
   4. Click "Go to ### project name ###(unsafe)"
   5. Click "Allow" button.

6. Click "OK".

7. Copy the URL of Web Apps. It's like `https://script.google.com/macros/s/###/exec`.

   - **When you modified the Google Apps Script, please redeploy as new version. By this, the modified script is reflected to Web Apps. Please be careful this.**

You can see the detail information of Web Apps at [here](https://developers.google.com/apps-script/guides/web) and [here](https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script).

## 6. Testing. (client side)

Please copy and paste the following script (HTML and Javascript) to a file. This file can be put outside of GAS project. This script is for uploading files to Google Drive.

Please set the variable of `webAppsUrl` to the URL of your deployed Web Apps.

```html
<script src="https://cdn.jsdelivr.net/gh/tanaikech/ResumableUploadForGoogleDrive_js@master/resumableupload_js.min.js"></script>

<body>
  <form>
    <input name="file" id="uploadfile" type="file" />
  </form>
  <div id="progress"></div>
</body>

<script>
  document.getElementById("uploadfile").addEventListener("change", run, false);

  function run(obj) {
    const file = obj.target.files[0];
    if (file.name != "") {
      let fr = new FileReader();
      fr.fileName = file.name;
      fr.fileSize = file.size;
      fr.fileType = file.type;
      fr.readAsArrayBuffer(file);
      fr.onload = resumableUpload;
    }
  }

  async function resumableUpload(e) {
    const webAppsUrl = "https://script.google.com/macros/s/###/exec"; // <--- Please set the URL of the deployed Web Apps.

    const url = `${webAppsUrl}?key=sampleKey&work=start`;
    const obj = JSON.parse(atob(await fetch(url).then((res) => res.text())));
    document.getElementById("progress").innerHTML = "Initializing.";
    const f = e.target;
    const resource = {
      fileName: f.fileName,
      fileSize: f.fileSize,
      fileType: f.fileType,
      fileBuffer: f.result,
      folderId: obj.folderId,
      accessToken: obj.accessToken,
    };
    const ru = new ResumableUploadToGoogleDrive();
    ru.Do(resource, async (res, err) => {
      if (err) {
        console.log(err);
        return;
      }
      let msg = "";
      if (res.status == "Uploading") {
        msg =
          Math.round(
            (res.progressNumber.current / res.progressNumber.end) * 100
          ) + "%";
      } else if (res.status == "Done") {
        const url = `${webAppsUrl}?key=sampleKey&work=end&fileId=${res.result.id}`;
        msg = await fetch(url)
          .then((r) => r.text())
          .catch((e) => console.log(e)); // When you can see "Done." at the console, it indicates that the process was finished.
      }
      document.getElementById("progress").innerText = msg;
    });
  }
</script>
```

Above script can be also seen by `clientSide.html`.

- The script for uploading file with the resumable upload is from [ResumableUploadForGoogleDrive_js](https://github.com/tanaikech/ResumableUploadForGoogleDrive_js). Using this script, the file is uploaded to Google Drive.

# Note

- In this method, the uploaded file is saved by changing the owner of the uploaded file using the service account. So in order to change the owner of the uploaded file, the uploaded file is copied. When the owner of the file can be directly changed, the process cost will be able to be reduced more. But in the current stage, when the owner of the files, which are not Google Docs files, of service account is changed, an error of `Bad Request. User message: \"You can't change the owner of this item.\"` occurs. So I changed the owner of file by copying.

- **In order to save the uploaded file, the owner of uploaded file is changed by copying the uploaded file. So, when the file size is large, please be careful the remaining storage capacity.**

- As other method, I think that the temp folder in above method can be created in the Drive of service account. In that case, it is required to share the temp folder with your Google account. Please be careful this.

# References

- [Uploading File to Google Drive from External HTML without Authorization](https://tanaikech.github.io/2020/08/13/uploading-file-to-google-drive-from-external-html-without-authorization/)
- [Uploading File to Google Drive using HTML and Google Apps Script](https://tanaikech.github.io/2020/02/18/uploading-file-to-google-drive-using-html-and-google-apps-script/)
- [ResumableUploadForGoogleDrive_js](https://github.com/tanaikech/ResumableUploadForGoogleDrive_js)
- [Taking advantage of Web Apps with Google Apps Script](https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script)

---

<a name="licence"></a>

# Licence

[MIT](LICENCE)

<a name="author"></a>

# Author

[Tanaike](https://tanaikech.github.io/about/)

If you have any questions and commissions for me, feel free to tell me.

<a name="updatehistory"></a>

# Update History

- v1.0.0 (December 29, 2020)

  1. Initial release.

[TOP](#top)
