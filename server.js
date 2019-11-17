// Built-in Node.js modules
var fs = require('fs');
var path = require('path');

// NPM modules
var express = require('express');
var sqlite3 = require('sqlite3');


var public_dir = path.join(__dirname, 'public');
var template_dir = path.join(__dirname, 'templates');
var db_filename = path.join(__dirname, 'db', 'usenergy.sqlite3');

var app = express();
var port = 8000;

// open usenergy.sqlite3 database
var db = new sqlite3.Database(db_filename, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.log('Error opening ' + db_filename);
    } else {
        console.log('Now connected to ' + db_filename);
    }
});

app.use(express.static(public_dir));

// GET request handler for '/'
app.get('/', (req, res) => {
    ReadFile(path.join(template_dir, 'index.html')).then((template) => {
        let response = template;
        db.all("SELECT * FROM Consumption WHERE year =?", ["2017"], (err,rows) =>{
            let coalCount = 0;
            let gasCount = 0;
            let nuclearCount = 0;
            let petroleumCount = 0;
            let renewableCount = 0; 
            let i; 
            
            for (i = 0; i < rows.length; i++){
                
                coalCount += rows[i]['coal'];  
                gasCount += rows[i]['natural_gas'];
                nuclearCount += rows[i]['nuclear']; 
                petroleumCount += rows[i]['petroleum'];
                renewableCount += rows[i]['renewable'];
            }
            
            response = response.replace('!!Coalcount!!', coalCount);
            response = response.replace('!!Gascount!!', gasCount);
            response = response.replace('!!NuclearCount!!', nuclearCount);
            response = response.replace('!!PetroleumCount!!', petroleumCount);
            response = response.replace('!!RenewableCount!!', renewableCount);
            
            let table = '';
            for (i = 0; i < rows.length; i++){
                table += '<tr>'; 
                table += '<td>' + rows[i]['state_abbreviation'] + '</td>';
                table += '<td>' + rows[i]['coal'] + '</td>';
                table += '<td>' + rows[i]['natural_gas'] + '</td>';
                table += '<td>' + rows[i]['nuclear'] + '</td>';
                table += '<td>' + rows[i]['petroleum'] + '</td>';
                table += '<td>' + rows[i]['renewable'] + '</td>';
                table += '</tr>'
            }

            response = response.replace('<!-- Data to be inserted here -->', table);

            
            WriteHtml(res, response);
        });
    }).catch((err) => {
        Write404Error(res);
    });
});

// GET request handler for '/year/*'
app.get('/year/:selected_year', (req, res) => {
    let yearReq = req.params.selected_year;
    let intYearReq = parseInt(yearReq);
    if (intYearReq <= 2017 && intYearReq >= 1960)
    {
        ReadFile(path.join(template_dir, 'year.html')).then((template) => {
            let response = template;

            response = response.replace(/!!!CHANGEYEAR!!!/g, yearReq);
            db.all("SELECT * FROM Consumption WHERE year =?", [yearReq], (err,rows) =>{
                let coalCount = 0;
                let gasCount = 0;
                let nuclearCount = 0;
                let petroleumCount = 0;
                let renewableCount = 0; 
                let i; 
                
                for (i = 0; i < rows.length; i++){
                    coalCount += rows[i]['coal'];  
                    gasCount += rows[i]['natural_gas'];
                    nuclearCount += rows[i]['nuclear']; 
                    petroleumCount += rows[i]['petroleum'];
                    renewableCount += rows[i]['renewable'];
                }
                
                response = response.replace('!!Coalcount!!', coalCount);
                response = response.replace('!!Gascount!!', gasCount);
                response = response.replace('!!NuclearCount!!', nuclearCount);
                response = response.replace('!!PetroleumCount!!', petroleumCount);
                response = response.replace('!!RenewableCount!!', renewableCount);

                let table = '';
                let total;
                for (i = 0; i < rows.length; i++){
                    table += '<tr>'; 
                    table += '<td>' + rows[i]['state_abbreviation'] + '</td>';
                    table += '<td>' + rows[i]['coal'] + '</td>';
                    table += '<td>' + rows[i]['natural_gas'] + '</td>';
                    table += '<td>' + rows[i]['nuclear'] + '</td>';
                    table += '<td>' + rows[i]['petroleum'] + '</td>';
                    table += '<td>' + rows[i]['renewable'] + '</td>';
                    total = rows[i]['coal'] + rows[i]['natural_gas'] + rows[i]['nuclear'] + rows[i]['petroleum'] + rows[i]['renewable'];
                    table += '<td>' + total + '</td>';
                    table += '</tr>'
                }

                response = response.replace('<!-- Data to be inserted here -->', table);
                response  = replaceYearButton(response, intYearReq);
                WriteHtml(res, response);
            });

        }).catch((err) => {
            Write404Error(res);
        });
    } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.write('Error: no data for year: '+yearReq);
        res.end();
    }
});

function replaceYearButton(response, year){
    if(year === 1960)
    {
        response = response.replace(/!!PrevYear!!/g, year);
        response = response.replace(/!!NextYear!!/g, year + 1);
    }

    else if (year === 2017)
    {
        response = response.replace(/!!NextYear!!/g, year);
        response = response.replace(/!!PrevYear!!/g, year -1 );
    }
     
    else
    {
        response = response.replace(/!!PrevYear!!/g, year -1 );
        response = response.replace(/!!NextYear!!/g, year + 1);
    }

    return response;
}
// GET request handler for '/state/*'
app.get('/state/:selected_state', (req, res) => {
    let stateAbbrName = req.params.selected_state; // Abbreviated state requested
    if(Object.keys(statePrevNext).includes(stateAbbrName)) {
        ReadFile(path.join(template_dir, 'state.html')).then((template) => {
            let response = template;
            // modify `response` here

            response = replaceStateTemplateImages(response, stateAbbrName);
            response = replaceStateTemplatePagination(response, stateAbbrName);

            let stateNamePromise = new Promise((resolve, reject) => {
                db.get("SELECT state_name FROM States WHERE state_abbreviation = ?", stateAbbrName, (err, row) => {
                    let stateFullName = row.state_name;
                    response = response.replace('!!StateFullName!!', stateFullName);
                    resolve();
                });
            });

            let stateConsumptionPromise = new Promise((resolve, reject) => {
                db.all("SELECT * FROM Consumption WHERE state_abbreviation = ?", stateAbbrName, (err, rows) => {
                    response = replaceStateTemplateTable(response, rows);
                    response = replaceStateTemplateVariables(response, rows);
                    resolve();
                });
            });

            // Write html when both promises are done
            Promise.all([stateNamePromise, stateConsumptionPromise]).then((values) => {
                WriteHtml(res, response); // write when both promises are done
            })
        }).catch((err) => {
            Write404Error(res);
        });
    } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.write('Error: no data for state '+stateAbbrName);
        res.end();
    }
});
// Replace state images source and alt in template
function replaceStateTemplateImages(response, stateAbbrName){
    let stateImagePath = '/images/states/'+stateAbbrName+'.png'; // file path for state image
    response = response.replace(/!!StateAbbrName!!/g, stateAbbrName); // Replace all state abbreviation
    response = response.replace('!!StateImage!!', stateImagePath); // Replace state image src
    response = response.replace('!!StateImageAlt!!', 'State of '+stateAbbrName+' image'); // Replace state image alt
    return response;
}

let statePrevNext = {
    AK:{prev:'WY',next:'AL'},AL:{prev:'AK',next:'AR'},AR:{prev:'AL',next:'AZ'},AZ:{prev:'AR',next:'CA'},
    CA:{prev:'AZ',next:'CO'},CO:{prev:'CA',next:'CT'},CT:{prev:'CO',next:'DC'},DC:{prev:'CT',next:'DE'},
    DE:{prev:'DC',next:'FL'},FL:{prev:'DE',next:'GA'},GA:{prev:'FL',next:'HI'},HI:{prev:'GA',next:'IA'},
    IA:{prev:'HI',next:'ID'},ID:{prev:'IA',next:'IL'},IL:{prev:'ID',next:'IN'},IN:{prev:'IL',next:'KS'},
    KS:{prev:'IN',next:'KY'},KY:{prev:'KS',next:'LA'},LA:{prev:'KY',next:'MA'},MA:{prev:'LA',next:'MD'},
    MD:{prev:'MA',next:'ME'},ME:{prev:'MD',next:'MI'},MI:{prev:'ME',next:'MN'},MN:{prev:'MI',next:'MO'},
    MO:{prev:'MN',next:'MS'},MS:{prev:'MO',next:'MT'},MT:{prev:'MS',next:'NC'},NC:{prev:'MT',next:'ND'},
    ND:{prev:'NC',next:'NE'},NE:{prev:'ND',next:'NH'},NH:{prev:'NE',next:'NJ'},NJ:{prev:'NH',next:'NM'},
    NM:{prev:'NJ',next:'NV'},NV:{prev:'NM',next:'NY'},NY:{prev:'NV',next:'OH'},OH:{prev:'NY',next:'OK'},
    OK:{prev:'OH',next:'OR'},OR:{prev:'OK',next:'PA'},PA:{prev:'OR',next:'RI'},RI:{prev:'PA',next:'SC'},
    SC:{prev:'RI',next:'SD'},SD:{prev:'SC',next:'TN'},TN:{prev:'SD',next:'TX'},TX:{prev:'TN',next:'UT'},
    UT:{prev:'TX',next:'VA'},VA:{prev:'UT',next:'VT'},VT:{prev:'VA',next:'WA'},WA:{prev:'VT',next:'WI'},
    WI:{prev:'WA',next:'WV'},WV:{prev:'WI',next:'WY'},WY:{prev:'WV',next:'AK'}
};
// Replaces next and previous state buttons links
function replaceStateTemplatePagination(response, stateAbbrName){
    response = response.replace(/!!PrevStateAbbr!!/g, statePrevNext[stateAbbrName].prev);
    response = response.replace(/!!NextStateAbbr!!/g, statePrevNext[stateAbbrName].next);
    return response;
}
// Build state table html and fill in template
function replaceStateTemplateTable(response, rows){
    let tableBody = '';
    let row, total, col;
    for(let i = 0; i < rows.length; i++){
        row = rows[i];
        // Fill in table
        total = 0;
        tableBody += '<tr>';
        for(col of Object.keys(row)){
            if(col !== 'state_abbreviation') {
                tableBody += '<td>' + row[col] + '</td>';
                total += row[col];
            }
        }
        tableBody += '<td>'+total+'</td>';
        tableBody += '</tr>';
    }

    response = response.replace('!!StateTableData!!', tableBody);

    return response;
}
// Fill state consumption array variables in template
function replaceStateTemplateVariables(response, rows){
    let coalCounts = [];
    let naturalGasCounts = [];
    let nuclearCounts = [];
    let petroleumCounts = [];
    let renewableCounts = [];

    let row;
    for(let i = 0; i < rows.length; i++){
        row = rows[i];
        // Push values into arrays for graph
        coalCounts.push(row.coal);
        naturalGasCounts.push(row.natural_gas);
        nuclearCounts.push(row.nuclear); // How can there be negative consumption?
        petroleumCounts.push(row.petroleum);
        renewableCounts.push(row.renewable);
    }

    response = response.replace('!!CoalCounts!!', coalCounts);
    response = response.replace('!!GasCounts!!', naturalGasCounts);
    response = response.replace('!!NuclearCounts!!', nuclearCounts);
    response = response.replace('!!PetroleumCounts!!', petroleumCounts);
    response = response.replace('!!RenewableCounts!!', renewableCounts);

    return response;
}

// GET request handler for '/energy-type/*'
app.get('/energy-type/:selected_energy_type', (req, res) => {
	let energyType = req.params.selected_energy_type;
	if(Object.keys(energyPrevNext).includes(energyType)){
        ReadFile(path.join(template_dir, 'energy.html')).then((template) => {
            let response = template;
            // modify `response` here
            let energyType = req.params.selected_energy_type;
            //response = response.replace('!!!energy_type!!!', energyType); // replace energy type
            // response = response.replace(/!!!ENERGY_TITLE_HEAD!!!/g,energyNeatName[energyType].name);//changes title
            response = response.replace(/!!!ENERGYTYPE!!!/g, energyNeatName[energyType].name); // Replace all instances for energy
            response = replaceEnergyTemplateImages(response, energyType);
            response = replaceEnergyTemplatePagination(response, energyType);

            let energyCounts = {};
            let row, coalEachYear;
            let promises = [];
            for(let state of Object.keys(statePrevNext)) {
                promises.push(
                    new Promise((resolve, reject) => {
                        db.all("SELECT "+energyType+" FROM Consumption WHERE state_abbreviation = ? ORDER BY year ASC", state, (err, rows) => {
                            coalEachYear = [];
                            for(let i=0; i<rows.length; i++){
                                row = rows[i];
                                coalEachYear.push(row[energyType]);
                            }
                            energyCounts[state] = coalEachYear;
                            resolve();
                        });
                    })
                );
            }

            Promise.all(promises).then(() => {
                response = response.replace('!!EnergyCounts!!', JSON.stringify(energyCounts));
                response = replaceEnergyTemplateTable(response, energyCounts);
                WriteHtml(res, response); // write when all promises are done
            });

        }).catch((err) => {
            Write404Error(res);
        });
    } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.write('Error: no data for energy type: '+energyType);
        res.end();
    }
});

// Build energy table html and fill in template
function replaceEnergyTemplateTable(response, energyCounts){
    let tableBody = '';
    let state, total, count;
    for(let i = 0; i <= 2017-1960; i++){
        total = 0;
        tableBody += '<tr>';
        tableBody += '<td>' + (i+1960) + '</td>';
        for(state of Object.keys(energyCounts)){
            count = energyCounts[state][i];
            tableBody += '<td>' + count + '</td>';
            total += count;
        }
        tableBody += '<td>' + total + '</td>';
        tableBody += '</tr>';
    }

    response = response.replace('!!!EnergyTableData!!!', tableBody);

    return response;
}


// Replace energy images source and alt in template
function replaceEnergyTemplateImages(response, energyType){
    let energyImagePath = '/images/energy/'+energyType+'.png'; // file path for state image
    response = response.replace('!!ENERGYImage!!', energyImagePath); // Replace energy image src
    response = response.replace('!!ENERGYImageAlt!!', energyNeatName[energyType].name+' image'); // Replace energy image alt
    return response;
}

// Replaces next and previous energy buttons links
function replaceEnergyTemplatePagination(response, energyType){
	response = response.replace(/!!!PREV_ENERGY_TYPE_NEAT!!!/g, energyNeatName[energyPrevNext[energyType].prev].name);
    response = response.replace(/!!!NEXT_ENERGY_TYPE_NEAT!!!/g, energyNeatName[energyPrevNext[energyType].next].name);
    response = response.replace(/!!!PREV_ENERGY_TYPE!!!/g, energyPrevNext[energyType].prev);
    response = response.replace(/!!!NEXT_ENERGY_TYPE!!!/g, energyPrevNext[energyType].next);
    return response;
}

// Maps an energy to the previous and next energy for pagination
let energyPrevNext = {
    coal:{prev:'renewable',next:'natural_gas'},natural_gas:{prev:'coal',next:'nuclear'},nuclear:{prev:'natural_gas',next:'petroleum'},petroleum:{prev:'nuclear',next:'renewable'},
    renewable:{prev:'petroleum',next:'coal'}
};

let energyNeatName = {
	coal:{name:'Coal'},natural_gas:{name:'Natural Gas'},nuclear:{name:'Nuclear'},petroleum:{name:'Petroleum'},
    renewable:{name:'Renewable'}
};

function ReadFile(filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data.toString());
            }
        });
    });
}

function Write404Error(res) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.write('Error: file not found');
    res.end();
}

function WriteHtml(res, html) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(html);
    res.end();
}


var server = app.listen(port);
