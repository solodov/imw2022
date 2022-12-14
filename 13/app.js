/* exported gapiLoaded */
/* exported gisLoaded */
/* exported handleAuthClick */
/* exported handleSignoutClick */

// TODO(developer): Set to client ID and API key from the Developer Console
const CLIENT_ID = '757615654795-4upi495dkd0svl99e4kikgtni4fhbpu5.apps.googleusercontent.com';
// const API_KEY = '<YOUR_API_KEY>';

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

document.getElementById('authorize_button').style.visibility = 'hidden';
document.getElementById('signout_button').style.visibility = 'hidden';

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded() {
  gapi.load('client', intializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to ini tialize the API.
 */
async function intializeGapiClient() {
  await gapi.client.init({
    // apiKey: API_KEY,
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
    document.getElementById('authorize_button').innerText = 'Refresh';
    document.getElementById('spreadsheet_url').disabled = false;
    document.getElementById('load_data_button').disabled = false;
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
    document.getElementById('spreadsheet_url').disabled = true;
    document.getElementById('load_data_button').disabled = true;
  }
}

/**
 * Print the names and majors of students in a sample spreadsheet:
 * https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 */
async function loadData() {
  let response;
  const url = new URL(document.getElementById('spreadsheet_url').value);
  let spreadsheetId = url.pathname.split('/')[3];
  try {
    // Fetch first 10 files
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
  // Process data from the spreadsheet.
  processData(range.values);
}

const epaLinkBase = 'https://frs-public.epa.gov/ords/frs_public2/fii_query_dtl.disp_program_facility?p_registry_id=';
let infoWindows = [];

// Map of EPA program names to their icons.
// More icons available at https://sites.google.com/site/gmapsdevelopment/
const markerIcons = {
  Superfund: 'http://maps.google.com/mapfiles/ms/micons/purple-dot.png',
  Brownfields: 'http://maps.google.com/mapfiles/ms/micons/orange-dot.png',
};

/**
 * Returns an icon for an EPA program. Yellow pin is used for unknown programs.
 */
function markerIcon(program) {
  if (program in markerIcons) {
    return markerIcons[program];
  }
  return 'http://maps.google.com/mapfiles/ms/micons/yellow.png';
}

function processData(values) {
  // Clear existing data from the table.
  document.getElementById('data_table').innerHTML = '';

  const dataTable = document.createElement('table');
  const dataTableBody = document.createElement('tbody');
  dataTable.appendChild(dataTableBody);
  document.getElementById('data_table').appendChild(dataTable);

  for(let i = 0; i < values.length; i++) {
    // unpack values array into variables
    const name = values[i][0];
    const latLng = new google.maps.LatLng(values[i][1], values[i][2]);
    const program = values[i][3];
    const address = values[i][4];
    const city = values[i][5];
    const state = values[i][6];
    const zipCode = values[i][7];
    const regId = values[i][9];

    // Create new table row
    const row = document.createElement('tr');
    dataTableBody.appendChild(row);

    // Create new table cell
    const cell = document.createElement('td');
    row.appendChild(cell);

    // Create iframe link
    const iframeLink = document.createElement('a');
    cell.appendChild(iframeLink);

    const infoWindowContent =
          `<p><b>${name}</b></p>` +
          `<p>EPA Program: <b>${program}</b></p>` +
          `<p>${address}</p>` +
          `<p>${city}</p>` +
          `<p>${state}, ${zipCode}</p>`;
    const infoWindow = new google.maps.InfoWindow({
      content: infoWindowContent,
      ariaLabel: name,
    });
    infoWindows.push(infoWindow);

    const marker = new google.maps.Marker({
      position: latLng,
      map: map,
      title: name,
      icon: markerIcon(program),
    });
    marker.addListener('click', () => {
      infoWindows.forEach(function (w) {
        w.close();
      });
      infoWindow.open({
        anchor: marker,
        map,
      });
    });

    // Populate iframe element properties.
    iframeLink.className = 'data-table-link';
    iframeLink.appendChild(document.createTextNode(name));
    iframeLink.addEventListener('click', function () {
      document.getElementById('site_data').src = epaLinkBase + regId;
      infoWindows.forEach(function (w) {
        w.close();
      });
      map.setCenter(latLng);
      map.setZoom(10);
      infoWindow.open({
        anchor: marker,
        map,
      });
    });

    // Create new window link
    const newWindowLink = document.createElement('a');
    cell.appendChild(newWindowLink);

    // Populate new window link eluement properties
    newWindowLink.href = epaLinkBase + regId;
    newWindowLink.target = '_blank';  // open EPA link in a new window.
    newWindowLink.appendChild(document.createTextNode('??????'));
  }
}

let map;

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: -34.397, lng: 150.644 },
    zoom: 8,
  });
}

window.initMap = initMap;
