/**
 *
 * flowcontrol adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "flowcontrol",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.0",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js flowcontrol Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <mail@flowcontrol.com>"
 *          ]
 *          "desc":         "flowcontrol adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "materialize":  true,                       // support of admin3
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "test1": true,
 *          "test2": 42,
 *          "mySelect": "auto"
 *      }
 *  }
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
const utils = require(__dirname + '/lib/utils'); // Get common adapter utils
const prettyMs = require('pretty-ms');
const path = require('path');
const util = require('util');
const http = require('http');

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.flowcontrol.0
const adapter = new utils.Adapter('flowcontrol');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

adapter.on('stateChange', function (id, state) {
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    if (!id || !state || state.ack) {
        return;
    }
    var l = id.split('.');
    if (l.length != 4) {
        adapter.info('what are you trying to set in ' + id + '???');
        return;
    }
    if (l[3] == 'valve') {
        if (state.val) {
            setValveOn();            
        } else {
            setValveOff();
        }
    }
});

function setState(obj_name, name, role, type, val, write) {
    adapter.getObject(obj_name, function(err, obj) { 
        if (!obj) {
            adapter.setObject(obj_name, {
            type: 'state',
            common: {
                name: name,
                role: role,
                type: type,
                read: true,
                write: write,
            },
            native: {}
            });
        }
    });
    adapter.setStateChanged(obj_name, { val: val, ack: true});
}

function setValveOn() {
    http.get('http://' + adapter.config.server + '/cmd?flowon', (resp) => {
        let data = '';
        
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });
        
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

function setValveOff() {
    http.get('http://' + adapter.config.server + '/cmd?flowoff', (resp) => {
        let data = '';
        
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });
        
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            setState('error', 'current error', 'indicator' , 'text', 'success', false);
            process(false);
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
        setState('error', 'current error', 'indicator' , 'text', 'command_failed', false);
    });
}

function process(to = true) {
    if (adapter.config.server) {
        http.get('http://' + adapter.config.server + '/alive', (resp) => {
            let data = '';
            
            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
                data += chunk;
            });
            
            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                var alive = JSON.parse(data);
                console.log(alive);
                setState('connected', 'connection', 'indicator' , 'bool', true, false);
                setState('alive', 'server alive', 'indicator' , 'number', alive.alive, false);
                setState('valve', 'current valve state', 'indicator' , 'text', alive.valve, false);
                if(to)
                    setTimeout(process, 15*1000);
            });
        }).on("error", (err) => {
            console.log("Error: " + err.message);
            setState('connected', 'connection', 'indicator' , 'bool', false, false);
            setState('alive', 'server alive', 'indicator' , 'number', -1, false);
            setState('valve', 'current valve state', 'indicator' , 'text', 'unknown', false);
            if(to)
                setTimeout(process, 5*1000);
        });
    }
}

function resetStates() {
    setState('command.valve', 'set valve state', 'switch' , 'bool', false, true);
    setState('valve', 'current valve state', 'indicator' , 'text', 'unknown', false);
    setState('error', 'current error', 'indicator' , 'text', 'success', false);
}

function main() {
    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:
    adapter.log.info('address of flowcontrol server: ' + adapter.config.server);

    // in this all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

    resetStates();
    process();
}
