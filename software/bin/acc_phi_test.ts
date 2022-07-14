import '../server/common/env';
import l from '../server/logger';

import { AccelerometerPhidget } from '../lib/AccelerometerPhidget';
import { AccelerometerResult } from '../lib/Accelerometer';

const acc = new AccelerometerPhidget(l, {
  acc_name: 'phidget',
  angleCorrection: {
    theta: -2,
    phi: 0
  }
});
acc.on('reading', (result: AccelerometerResult) => {
  l.info('mag: %s %s %s [%s, %s, %s]',
    result.magnitude.toString().substr(0, 6),
    result.theta.toString().substr(0, 6),
    result.phi.toString().substr(0, 6),
    result.reading[0].toString().substr(0, 6),
    result.reading[1].toString().substr(0, 6),
    result.reading[2].toString().substr(0, 6),
  );
})

setTimeout(() => {
  acc.start(2);
}, 1000);