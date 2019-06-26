import * as fs from 'fs';
import {google} from 'googleapis';
import { OAuth2Client } from 'googleapis-common';
import * as Bluebird from 'bluebird';
import * as Progress from 'progress';

const readline = require('readline');
const index: IFileList = require('../fileList.json');

const bar = new Progress(':bar :current/:total :eta', { total: countFilesInIndex(index), width: 100 });

const DATA_DIR = `${__dirname}/../downloadedData`;
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

async function downloadAll(auth: OAuth2Client){
    for(let directoryId in index){

        const path = `${DATA_DIR}/${index[directoryId].name}`
        if(!fs.existsSync(path)) fs.mkdirSync(path);

        await Bluebird.map(fileListToArray(index[directoryId].children), (file) => {
            const filePath = `${path}/${file.name}`;
            if(fs.existsSync(filePath) && fs.lstatSync(filePath).size > 100000){
                bar.tick();
                return null;
            }

            return new Bluebird(async (resolve, reject) => {

                const drive = google.drive({version: 'v3', auth});
                const dest = fs.createWriteStream(filePath);
                drive.files.get({fileId : file.id, alt: 'media'}, {responseType: 'stream'}, (err, res) => {
                    if(err){
                        console.error(err);
                        process.exit(1);
                    }
                    res!.data
                    .on('end', () => {
                        bar.tick();
                        dest.close();
                        resolve(null);
                    })
                    .on('error', (err: Error) => {
                        console.error(`Error downloading ${file.name}`);
                        console.error(err);
                        dest.close();
                        resolve(null);
                    })
                    .pipe(dest);
                })
            });
        }, {concurrency: 5});
    }
}

function countFilesInIndex(index: IFileList){
    let count = 0;
    for(let directoryId in index) count += Object.keys(index[directoryId].children).length;
    return count;
}

function fileListToArray(fileList: {[id: string] : IDriveFile}){
    const result: IDriveFile[] = [];
    for(let fileId in fileList) result.push(fileList[fileId]);
    return result;
}

interface IDriveFile {
    id: string
    name: string
}

interface IFileList {
    [id: string]: {
        id: string
        name: string
        children: {
            [id: string]: IDriveFile
        }
    }
}

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = `${__dirname}/../token.json`;

// Load client secrets from a local file.
fs.readFile(`${__dirname}/../credentials.json`, (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Drive API.
    authorize(JSON.parse(content as any as string), downloadAll);
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