// (c) 2013-2015 Don Coleman
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* global mainPage, deviceList, refreshButton, statusDiv */
/* global detailPage, resultDiv, messageInput, sendButton, disconnectButton */
/* global cordova, bluetoothSerial  */
/* jshint browser: true , devel: true*/

var mobile_num;
var bluetoothDeviceName;
var msg = 'none';
var lat;
var long;
var currentLocation;
'use strict';
var app = {
    initialize: function() {
        this.bindEvents();
        this.showMainPage();
    },
    bindEvents: function() {

        var TOUCH_START = 'touchstart';
        if (window.navigator.msPointerEnabled) { // windows phone
            TOUCH_START = 'MSPointerDown';
        }
        document.addEventListener('deviceready', this.onDeviceReady, false);
        refreshButton.addEventListener(TOUCH_START, this.refreshDeviceList, false);
        sendButton.addEventListener(TOUCH_START, this.sendData, false);
        disconnectButton.addEventListener(TOUCH_START, this.disconnect, false);
        deviceList.addEventListener('touchstart', this.connect, false);

    },
    onDeviceReady: function() {
        window.plugins.sim.hasReadPermission(success, error);
        window.plugins.sim.requestReadPermission(success, error);
        window.plugins.sim.getSimInfo(successCallback, errorCallback);
        cordova.plugins.locationAccuracy.request(function (success){
            console.log("Successfully requested accuracy: "+success.message);
            }, function (error){
                console.error("Accuracy request failed: error code="+error.code+"; error message="+error.message);
            window.location.reload(true);
            if(error.code !== cordova.plugins.locationAccuracy.ERROR_USER_DISAGREED){
                if(window.confirm("Failed to automatically set Location Mode to 'High Accuracy'. Would you like to switch to the Location Settings page and do this manually?")){
                    cordova.plugins.diagnostic.switchToLocationSettings();
                }
            }
        }, cordova.plugins.locationAccuracy.REQUEST_PRIORITY_HIGH_ACCURACY);
        app.refreshDeviceList();
    },
    refreshDeviceList: function() {
        bluetoothSerial.list(app.onDeviceList, app.onError);
    },
    onDeviceList: function(devices) {
        var option;

        // remove existing devices
        deviceList.innerHTML = "";
        app.setStatus("");
        devices.forEach(function(device) {
            bluetoothDeviceName = device.id;
            var listItem = document.createElement('li'),
                html = '<b>' + device.name + '</b><br/>' + device.id;

            listItem.innerHTML = html;

            if (cordova.platformId === 'windowsphone') {
              // This is a temporary hack until I get the list tap working
              var button = document.createElement('button');
              button.innerHTML = "Connect";
              button.addEventListener('click', app.connect, false);
              button.dataset = {};
              button.dataset.deviceId = device.id;
              listItem.appendChild(button);
            } else {
              listItem.dataset.deviceId = device.id;
            }
            deviceList.appendChild(listItem);
        });

        if (devices.length === 0) {

            option = document.createElement('option');
            option.innerHTML = "No Bluetooth Devices";
            deviceList.appendChild(option);

            if (cordova.platformId === "ios") { // BLE
                app.setStatus("No Bluetooth Peripherals Discovered.");
            } else { // Android or Windows Phone
                app.setStatus("Please Pair a Bluetooth Device.");
            }

        } else {
            app.setStatus("Found " + devices.length + " device" + (devices.length === 1 ? "." : "s."));
        }
        //navigator.geolocation.getCurrentPosition(onSuccess, onError);
    },
    connect: function(e) {
        var onConnect = function() {
                // subscribe for incoming data
                bluetoothSerial.subscribe('\n', app.onData, app.onError);

                resultDiv.innerHTML = "";
                app.setStatus("Connected");
                app.showDetailPage();
            };

        var deviceId = e.target.dataset.deviceId;
        bluetoothDeviceName = deviceId;
        if (!deviceId) { // try the parent
            deviceId = e.target.parentNode.dataset.deviceId;
        }

        bluetoothSerial.connect(deviceId, onConnect, app.onError);
    },
    onData: function(data) { // data received from Arduino
        console.log(data);
        resultDiv.innerHTML = resultDiv.innerHTML + "Received: " + data + "<br/>";
        resultDiv.scrollTop = resultDiv.scrollHeight;
        msg = msg +','+ data;
        navigator.geolocation.getCurrentPosition(onSuccess, onError);
    },
    sendData: function(event) { // send data to Arduino

        var success = function() {
            console.log("success");
            resultDiv.innerHTML = resultDiv.innerHTML + "Sent: " + messageInput.value + "<br/>";
            resultDiv.scrollTop = resultDiv.scrollHeight;
        };

        var failure = function() {
            alert("Failed writing data to Bluetooth peripheral");
        };

        var data = messageInput.value;
        bluetoothSerial.write(data, success, failure);
    },
    disconnect: function(event) {
        bluetoothSerial.disconnect(app.showMainPage, app.onError);
    },
    showMainPage: function() {
        mainPage.style.display = "";
        detailPage.style.display = "none";
    },
    showDetailPage: function() {
        mainPage.style.display = "none";
        detailPage.style.display = "";
    },
    setStatus: function(message) {
        console.log(message);

        window.clearTimeout(app.statusTimeout);
        statusDiv.innerHTML = message;
        statusDiv.className = 'fadein';

        // automatically clear the status with a timer
        app.statusTimeout = setTimeout(function () {
            statusDiv.className = 'fadeout';
        }, 5000);
    },
    onError: function(reason) {
        alert("ERROR: " + reason); // real apps should use notification.alert
    },
    sendDataToServer: function() {
        if(msg == 'none') { msg = '';}
        jQuery.ajax ({
            type: 'POST',
            async: false,
            url: 'http://www.miisky.com/svasth_insert.php',
            data: 'message='+encodeURIComponent(msg)+'&mac_no='+encodeURIComponent(bluetoothDeviceName)+'&diabetes=114&sim_no='+mobile_num+'&location='+encodeURIComponent(currentLocation),
            error: function(e) {
              alert('Please try again, if problem persists contact the administrator.');
            },
            beforeSend: function() {
                console.info('sending data...');
            },
            success: function(response) {
              console.log(response);
            }
        });
    }

};

function successCallback(result) {
    mobile_num = result.deviceId;
}

function errorCallback(error) {
    console.log(error);
}

function success(result) {
    console.log(result);
}

function error(error) {
    console.log(error);
}

function onSuccess(position) {
    lat  = position.coords.latitude;
    long = position.coords.longitude;
    displayLocation(lat,long);
};

// onError Callback receives a PositionError object
function onError(error) {
    alert('code: ' + error.code + '\n' + 'message: ' + error.message + '\n');
}


function displayLocation(latitude,longitude){
    var request = new XMLHttpRequest();

    var method = 'GET';
    var url = 'http://maps.googleapis.com/maps/api/geocode/json?latlng='+latitude+','+longitude+'&sensor=true';
    var async = true;

    request.open(method, url, async);
    request.onreadystatechange = function(){
      if(request.readyState == 4 && request.status == 200){
        var data = JSON.parse(request.responseText);
        var address = data.results[0];
        currentLocation = address.formatted_address;
        app.sendDataToServer();
      }
    };
    request.send();
}

