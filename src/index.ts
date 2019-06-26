import * as fs from 'fs';
const readline = require('readline');
import {google, drive_v3} from 'googleapis';
import { OAuth2Client } from 'googleapis-common';
const ROOT_FOLDER_ID = '0B3VGpW2CJGHqdldGVm9mZnJqWjg';
const pageSize = 1000;

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = `${__dirname}/../token.json`;

// Load client secrets from a local file.
fs.readFile(`${__dirname}/../credentials.json`, (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Drive API.
    authorize(JSON.parse(content as any as string), generateFileList);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials: any, callback: (arg0: OAuth2Client) => void) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token as any as string));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client: OAuth2Client, callback: (client: OAuth2Client) => void) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code: string) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token!);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

async function listFiles(auth: OAuth2Client, parentId: string) {
    const results: drive_v3.Schema$File[] = [];

    const drive = google.drive({version: 'v3', auth});
    const res = await drive.files.list({ q: `'${parentId}' in parents`, fields: 'files(name,id,capabilities)', pageSize });
    process.stdout.write('\n.');

    let pageToken = res.data.nextPageToken;
    Array.prototype.push.apply(results, res.data.files);

    while(pageToken){
        const nextPage = await drive.files.list({ q: `'${parentId}' in parents`, fields: 'files(name,id,capabilities)', pageToken, pageSize });
        process.stdout.write('.');
        pageToken = res.data.nextPageToken;
        Array.prototype.push.apply(results, nextPage.data.files);
    }
    process.stdout.write('\n');

    const fileTree: { [id: string]: ISchemaFileWithChildren } = {};
    results.forEach((currentFile) => {
        fileTree[currentFile.id!] = currentFile as ISchemaFileWithChildren;
    });
    return fileTree;
}

function isFolder(file: ISchemaFileWithChildren){
    if(Object.prototype.toString.call(file) === '[object String') return true;
    return file.capabilities!.canAddChildren || file.capabilities!.canListChildren;
}

interface ISchemaFileWithChildren extends drive_v3.Schema$File {
    children: { [id: string]: ISchemaFileWithChildren } | undefined
}

async function generateFileList(auth: OAuth2Client){
    const fileTree = await listFiles(auth, ROOT_FOLDER_ID);

    for(let child in fileTree){ await buildTreeFromRoot(fileTree[child]) }
    for(let child in fileTree){ formatOutput(fileTree[child]) }

    const output = JSON.stringify(fileTree);
    console.log(output);

    function formatOutput(root: any){
        delete root.capabilities;
        if(root.children && Object.keys(root.children).length){
            console.log(`formatting children of ${root.name || 'Root'}`);
            for(let child in root.children){
                formatOutput(root.children[child]);
            }
        }else{
            delete root.children;
        }
    }

    async function buildTreeFromRoot(root: ISchemaFileWithChildren){
        if(!isFolder(root)) return;
        console.log(`Building children of ${root.name} | ${root.id}`);
        root.children = await listFiles(auth, root.id!);
        console.log(`    ${root.name} had ${Object.keys(root.children).length} children`)
        for(let child in root.children){
            await buildTreeFromRoot(root.children[child])
        }
    }
}

// async function listFilesz(auth: OAuth2Client) {
//     const drive = google.drive({version: 'v3', auth});
//     const res = await drive.files.list({
//         q: `'${googleFolderId}' in parents`,
//         pageSize: 1000,
//     });
//     if(!res!.data.files) return console.log('Google API returned no files');
//     const files = res!.data.files;

//     if (files.length) {
//         console.log('Files:');
//         files.map((file) => {
//             console.log(`${file.name} (${file.id} | ${file.})`);
//         });
//     } else {
//         console.log('No files found.');
//     }
// }