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
