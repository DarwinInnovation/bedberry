// NOTE: This shows importing phidget22 in Node.JS. In-Browser JavaScript import is different
var phidget22 = require("phidget22");

var conn = new phidget22.Connection();
conn.connect().then(function () {
  var ch = new phidget22.Accelerometer();
  ch.open(2500).then(function () {

    var attached = ch.getAttached();
    console.log("Attached: " + attached);

    var minDataInterval = ch.getMinDataInterval();
    console.log("MinDataInterval: " + minDataInterval);

    setInterval(() => {
      var acceleration = ch.getAcceleration();
      console.log("Acceleration: " + acceleration + " s: " + Math.sqrt(acceleration[0] * acceleration[0] + acceleration[1] * acceleration[1] + acceleration[2] * acceleration[2]));
    }, 512);

  }).catch(function (err) {
    console.error("Error during open:", err);
  });
}).catch(function (err) {
  console.error("Error during connect:", err);
});
