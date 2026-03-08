import http from 'k6/http';
import { check } from 'k6';

export const options = {
    vus: 500,        // 500 Virtual Users
    duration: '10s', // For 10 seconds
};

export default function () {
    const url = 'http://localhost:3000/buy/1';
    const payload = JSON.stringify({});

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const res = http.post(url, payload, params);

    // Not asserting 202 because we EXPECT 400s when stock runs out!
    // Just want to see how the system handles the sheer volume.
    check(res, {
        'is status 202 or 400': (r) => r.status === 202 || r.status === 400,
    });
}
