const CLIENT_ID = '757615654795-4upi495dkd0svl99e4kikgtni4fhbpu5.apps.googleusercontent.com';

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly';

let map;
let data;
let infoWindows = [];
let tokenClient;
let gapiInited = false;
let gisInited = false;

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded() {
  gapi.load('client', intializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
async function intializeGapiClient() {
  await gapi.client.init({
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiInited = true;
  maybeEnableButtons();
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // defined later
  });
  gisInited = true;
  maybeEnableButtons();
}

/**
 * Enables user interaction after all libraries are loaded.
 */
function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    document.getElementById('authorize_button').style.visibility = 'visible';
  }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      throw (resp);
    }
    document.getElementById('signout_button').style.visibility = 'visible';
    document.getElementById('load_data_button').disabled = false;
    document.getElementById('spreadsheet_url').disabled = false;
    document.getElementById('authorize_button').innerText = 'Refresh Credentials';
  };

  if (gapi.client.getToken() === null) {
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    tokenClient.requestAccessToken({prompt: 'consent'});
  } else {
    // Skip display of account chooser and consent dialog for an existing session.
    tokenClient.requestAccessToken({prompt: ''});
  }
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
    document.getElementById('data_table').innerText = '';
    document.getElementById('authorize_button').innerText = 'Authorize';
    document.getElementById('signout_button').style.visibility = 'hidden';
    document.getElementById('load_data_button').disabled = true;
    document.getElementById('spreadsheet_url').disabled = true;
  }
}

/**
 * Print data from the spreadsheet in the input box.
 */
async function loadData() {
  let response;
  const url = new URL(document.getElementById('spreadsheet_url').value);
  let spreadsheetId = url.pathname.split('/')[3];
  try {
    response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'A2:J',
    });
  } catch (err) {
    document.getElementById('data_table').innerText = err.message;
    return;
  }
  const range = response.result;
  if (!range || !range.values || range.values.length == 0) {
    document.getElementById('data_table').innerText = 'No values found.';
    return;
  }

  // Preserve loaded data for later use.
  data = range.values;
  infoWindows.length = 0;

  const tbl = document.createElement("table");
  const tblBody = document.createElement("tbody");
  for(let i = 0; i < range.values.length; i++) {
    const lat = range.values[i][1];
    const lon = range.values[i][2];
    const latLng = new google.maps.LatLng(lat, lon);
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    var content =
        `<p><b>${range.values[i][0]}</b></p>` +
        `<p>EPA Program: <b>${range.values[i][3]}</b></p>` +
        `<p>${range.values[i][4]}</p>` +
        `<p>${range.values[i][5]}</p>` +
        `<p>${range.values[i][6]}</p>` +
        `<p>${range.values[i][7]}</p>`;
    const infoWindow = new google.maps.InfoWindow({
      content: content,
      ariaLabel: range.values[i][0],
    });
    infoWindows.push(infoWindow);

    const marker = new google.maps.Marker({
      position: latLng,
      map: map,
      title: range.values[i][0],
    });
    marker.addListener("click", () => {
      infoWindows.forEach(function (i) {
        i.close();
      });
      infoWindow.open({
        anchor: marker,
        map,
      });
    })
    let a = document.createElement('a');
    a.appendChild(document.createTextNode(range.values[i][0]));
    const link = `https://frs-public.epa.gov/ords/frs_public2/fii_query_dtl.disp_program_facility?p_registry_id=${range.values[i][9]}`;
    a.addEventListener('click', function () {
      document.getElementById('site_data').src = link;
      map.setCenter(latLng);
      map.setZoom(10);
      infoWindows.forEach(function (i) {
        i.close();
      });
      infoWindow.open({
        anchor: marker,
        map,
      });
    });

    cell.appendChild(a);
    row.appendChild(cell);
    tblBody.appendChild(row);
  }
  tbl.appendChild(tblBody);

  document.getElementById('data_table').innerHTML = '';
  document.getElementById('data_table').appendChild(tbl);
}

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: -34.397, lng: 150.644},
    zoom: 1
  });
}

window.initMap = initMap;
