const API_BASE_URL = 'https://inv-eng.onrender.com'; // Leave empty for relative paths or set to your Render URL later
const PRODUCT_ID = 1;
const stockDisplay = document.getElementById('stockDisplay');
const buyBtn = document.getElementById('buyBtn');
const simulateBtn = document.getElementById('simulateBtn');
const logsContainer = document.getElementById('logs');
const connStatus = document.getElementById('connStatus');
const explanationPanel = document.getElementById('explanationPanel');
const explanationText = document.getElementById('explanationText');

let currentStock = null;
let pollingInterval = null;

// Helper: Format integers
const formatNum = (num) => new Intl.NumberFormat().format(num);

function logDetail(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `log-entry log-${type}`;

    // Add timestamp
    const time = new Date().toISOString().split('T')[1].substring(0, 12);
    el.innerHTML = `<span class="highlight">[${time}]</span> ${msg}`;

    logsContainer.appendChild(el);
    logsContainer.scrollTop = logsContainer.scrollHeight;

    if (logsContainer.children.length > 50) {
        logsContainer.removeChild(logsContainer.firstChild);
    }
}

function updateConnectionStatus(isOnline) {
    if (isOnline) {
        connStatus.textContent = '● Services Online';
        connStatus.className = 'status-badge online';
    } else {
        connStatus.textContent = '● Redis Offline';
        connStatus.className = 'status-badge offline';
    }
}

function showExplanation(successes, soldOuts, errors, duration, initialStock, requestedBuyers) {
    explanationPanel.classList.remove('hidden');

    // Non-technical explanation generation
    let text = `You just had <strong>${formatNum(requestedBuyers)}</strong> people try to buy your sneaker in exactly <strong>${duration} milliseconds</strong>! `;

    if (successes > 0 && successes <= initialStock) {
        text += `Because you only had <strong>${formatNum(initialStock)}</strong> in stock, the system perfectly accepted <strong>${formatNum(successes)}</strong> orders. `;
    } else if (successes === 0 && soldOuts > 0) {
        text += `The item was completely <strong>sold out</strong>, so the system instantly rejected all <strong>${formatNum(soldOuts)}</strong> attempts using the Redis Cache without crashing. `;
    }

    if (soldOuts > 0 && successes > 0) {
        text += `The other <strong>${formatNum(soldOuts)}</strong> customers were gracefully turned away with a "Sold Out" message. `;
    }

    if (errors > 0) {
        text += `(Note: There were ${errors} unexpected errors, usually meaning the server was turned off or overloaded). `;
    }

    // The punchline for the recruiter
    const oversold = successes > initialStock;
    if (oversold) {
        text += `<br><br><strong style="color:var(--danger)">⚠️ SYSTEM FAILURE:</strong> We oversold by ${successes - initialStock} items! The concurrency lock failed.`;
    } else {
        text += `<br><br><strong style="color:var(--success)">✅ MISSION ACCOMPLISHED:</strong> Notice how the system didn't sell a single unit more than what was available? By using <span class="highlight">Redis</span> and <span class="highlight">Pessimistic Locking</span>, we completely prevented the "Overselling" problem that ruins flash sales!`;
    }

    explanationText.innerHTML = text;
}

async function fetchStock() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/stock/${PRODUCT_ID}`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();

        updateConnectionStatus(true);

        if (currentStock !== data.stock) {
            currentStock = data.stock;
            stockDisplay.textContent = formatNum(currentStock);

            // Pop animation on change
            stockDisplay.classList.remove('pop');
            void stockDisplay.offsetWidth; // trigger reflow
            stockDisplay.classList.add('pop');

            if (currentStock <= 0) {
                stockDisplay.classList.add('out-of-stock');
                buyBtn.querySelector('.btn-text').textContent = 'Sold Out';
                buyBtn.disabled = true;
            } else {
                stockDisplay.classList.remove('out-of-stock');
                buyBtn.querySelector('.btn-text').textContent = 'Buy Now';
                buyBtn.disabled = false;
            }
            simulateBtn.disabled = false;
        }
    } catch (err) {
        updateConnectionStatus(false);
    }
}

async function buyProduct() {
    buyBtn.disabled = true;
    buyBtn.querySelector('.btn-text').textContent = 'Securing...';

    try {
        const startTime = performance.now();
        const res = await fetch(`${API_BASE_URL}/buy/${PRODUCT_ID}`, { method: 'POST', signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        const latency = Math.round(performance.now() - startTime);

        if (res.ok || res.status === 202) {
            logDetail(`Order Processed! Server: ${data.message} (${latency}ms)`, 'success');
        } else {
            logDetail(`Rejected: ${data.message || data.error} (${latency}ms)`, 'error');
        }
    } catch (err) {
        logDetail(`Error: ${err.message}`, 'error');
    } finally {
        await fetchStock();
    }
}

async function simulateTraffic() {
    const numRequests = parseInt(document.getElementById('simBuyers').value) || 100;
    const initialStock = parseInt(document.getElementById('setupStock').value) || 70;

    simulateBtn.disabled = true;
    buyBtn.disabled = true;
    explanationPanel.classList.add('hidden'); // hide while running

    // 1. Set the initial stock 
    logDetail(`Initializing database and cache stock to ${initialStock}...`, 'info');
    try {
        await fetch(`${API_BASE_URL}/api/stock/${PRODUCT_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock: initialStock })
        });
        await fetchStock(); // Refresh UI instantly
    } catch (err) {
        logDetail(`Failed to setup backend stock: ${err.message}`, 'error');
        simulateBtn.disabled = false;
        buyBtn.disabled = false;
        return;
    }

    logDetail(`Bombarding server with ${numRequests} concurrent virtual buyers...`, 'warning');

    // Stop polling during heavy load to dedicate browser network to POST
    clearInterval(pollingInterval);

    const startTime = performance.now();
    const promises = [];

    for (let i = 0; i < numRequests; i++) {
        promises.push(
            fetch(`${API_BASE_URL}/buy/${PRODUCT_ID}`, { method: 'POST', signal: AbortSignal.timeout(10000) })
                .then(async r => {
                    const text = await r.text();
                    try {
                        return { status: r.status, data: JSON.parse(text) };
                    } catch {
                        return { status: r.status, data: { message: text } };
                    }
                })
                .catch(e => ({ status: 0, error: e.message }))
        );
    }

    // Fire all requests concurrently
    const results = await Promise.allSettled(promises);
    const endTime = performance.now();

    let successes = 0;
    let outOfStocks = 0;
    let errors = 0;

    results.forEach(res => {
        if (res.status === 'fulfilled') {
            const { status, data } = res.value;
            if (status === 202 || status === 200) successes++;
            else if (status === 400) outOfStocks++;
            else errors++;
        } else {
            errors++;
        }
    });

    const duration = Math.round(endTime - startTime);
    logDetail(`Simulation finished in ${duration}ms!`, 'info');
    logDetail(`Captured: ${successes} Success, ${outOfStocks} Sold Out, ${errors} Errors`, 'success');

    // Show non-tech explanation
    showExplanation(successes, outOfStocks, errors, duration, initialStock, numRequests);

    // Restart polling
    pollingInterval = setInterval(fetchStock, 1000);
    await fetchStock();
    simulateBtn.disabled = false;
}

buyBtn.addEventListener('click', buyProduct);
simulateBtn.addEventListener('click', simulateTraffic);

document.getElementById('simBuyers').addEventListener('input', (e) => {
    simulateBtn.textContent = `Setup & Simulate ${e.target.value} Buyers`;
});

// Initial start
fetchStock().then(() => {
    pollingInterval = setInterval(fetchStock, 1000);
});
