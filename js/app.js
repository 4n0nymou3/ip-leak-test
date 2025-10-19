class IPLeakTester {
    constructor() {
        this.cloudflareData = null;
        this.otherData = null;
        this.ipv6Data = null;
        this.webrtcIPs = [];
        this.dnsResults = [];
        this.isLoading = false;
        this.testStartTime = null;
        this.cfMap = null;
        this.otherMap = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.startInitialTests();
    }
    
    setupEventListeners() {
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.addEventListener('click', () => this.handleRefresh());
        
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.addEventListener('click', () => this.handleExport());
        
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleTabSwitch(e));
        });
        
        window.onWebRTCIP = (ipInfo) => {
            this.displayWebRTCIPRealtime(ipInfo);
        };
        
        window.addEventListener('online', () => {
            this.updateStatus('success', 'Connection restored. Click refresh to update.');
        });
        
        window.addEventListener('offline', () => {
            this.updateStatus('error', 'No internet connection detected.');
        });
    }
    
    async handleRefresh() {
        if (this.isLoading) {
            console.log('Already loading, please wait...');
            return;
        }
        
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.classList.add('loading');
        refreshBtn.disabled = true;
        
        this.resetData();
        this.resetUI();
        
        await this.startInitialTests();
        
        setTimeout(() => {
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
        }, 500);
    }
    
    resetData() {
        this.cloudflareData = null;
        this.otherData = null;
        this.ipv6Data = null;
        this.webrtcIPs = [];
        this.dnsResults = [];
        
        if (Tests.webrtcConnection) {
            Tests.webrtcConnection.close();
            Tests.webrtcConnection = null;
        }
        Tests.detectedIPs.clear();
        
        if (this.cfMap) {
            this.cfMap.remove();
            this.cfMap = null;
        }
        if (this.otherMap) {
            this.otherMap.remove();
            this.otherMap = null;
        }
    }
    
    resetUI() {
        this.showSkeletonLoading('cloudflare');
        this.showSkeletonLoading('other');
        
        const ipv6Fields = ['ip', 'country', 'city', 'isp'];
        ipv6Fields.forEach(field => {
            const el = document.getElementById(`ipv6-${field}`);
            if (el) {
                el.innerHTML = '<div class="skeleton"></div>';
                el.style.color = '';
            }
        });
        
        document.getElementById('webrtc-status').innerHTML = '<span class="status-badge status-loading">Testing...</span>';
        document.getElementById('webrtc-ips').innerHTML = '<div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div></div>';
        
        document.getElementById('dns-status').innerHTML = '<span class="status-badge status-loading">Testing...</span>';
        document.getElementById('dns-servers').innerHTML = '<div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
        
        document.getElementById('cf-map').innerHTML = '';
        document.getElementById('cf-map').style.display = 'none';
        document.getElementById('other-map').innerHTML = '';
        document.getElementById('other-map').style.display = 'none';
    }
    
    handleExport() {
        const data = {
            cloudflare: this.cloudflareData,
            other: this.otherData,
            ipv6: this.ipv6Data,
            webrtc: this.webrtcIPs,
            dns: this.dnsResults
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ip-leak-test-results.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    handleTabSwitch(e) {
        const targetTab = e.target.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(targetTab).classList.add('active');
        
        setTimeout(() => {
            if (targetTab === 'cloudflare' && this.cfMap) {
                this.cfMap.invalidateSize();
            } else if (targetTab === 'other' && this.otherMap) {
                this.otherMap.invalidateSize();
            }
        }, 100);
    }
    
    async startInitialTests() {
        if (this.isLoading) {
            console.log('Tests already running...');
            return;
        }
        
        this.isLoading = true;
        this.testStartTime = Date.now();
        this.updateStatus('loading', 'Running security tests...');
        
        try {
            const results = await Promise.allSettled([
                API.fetchWithRetry(() => API.fetchCloudflareData()),
                API.fetchWithRetry(() => API.fetchIpifyData()),
                API.fetchWithRetry(() => API.fetchIPv6Data()),
                this.runWebRTCTest(),
                this.runDNSTest()
            ]);
            
            this.cloudflareData = results[0].status === 'fulfilled' ? results[0].value : null;
            this.otherData = results[1].status === 'fulfilled' ? results[1].value : null;
            this.ipv6Data = results[2].status === 'fulfilled' ? results[2].value : null;
            
            if (this.cloudflareData) {
                this.displayCloudflareData(this.cloudflareData);
            } else {
                this.displayError('cloudflare');
            }
            
            if (this.otherData) {
                this.displayOtherData(this.otherData);
            } else {
                this.displayError('other');
            }
            
            if (this.ipv6Data) {
                this.displayIPv6Data(this.ipv6Data);
            } else {
                this.displayIPv6Error();
            }
            
            this.compareResults();
            this.updateLastUpdateTime();
            
            const testDuration = Date.now() - this.testStartTime;
            console.log(`All tests completed in ${testDuration}ms`);
        } catch (error) {
            console.error('Error during tests:', error);
            this.updateStatus('error', 'An error occurred during testing.');
        } finally {
            this.isLoading = false;
        }
    }
    
    async runWebRTCTest() {
        const statusEl = document.getElementById('webrtc-status');
        statusEl.innerHTML = '<span class="status-badge status-loading">Testing...</span>';
        
        const ipsContainer = document.getElementById('webrtc-ips');
        ipsContainer.innerHTML = '<div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div></div>';
        
        try {
            this.webrtcIPs = await Tests.performWebRTCTest();
            
            if (!this.webrtcIPs || this.webrtcIPs.length === 0) {
                ipsContainer.innerHTML = '<div class="ip-item"><div class="ip-address">✓ No additional IPs exposed by WebRTC</div><div class="ip-type">Safe</div></div>';
                statusEl.innerHTML = '<span class="status-badge status-safe">✓ Safe</span>';
            } else {
                this.displayWebRTCResults();
                
                const publicIP = this.cloudflareData ? this.cloudflareData.ip : null;
                const analysis = Tests.analyzeWebRTCResults(this.webrtcIPs, publicIP);
                
                if (analysis.hasLeak) {
                    statusEl.innerHTML = '<span class="status-badge status-leak">⚠ Leak Detected</span>';
                } else {
                    statusEl.innerHTML = '<span class="status-badge status-safe">✓ Safe</span>';
                }
            }
        } catch (error) {
            console.error('WebRTC test error:', error);
            statusEl.innerHTML = '<span class="status-badge status-leak">✗ Error</span>';
            ipsContainer.innerHTML = '<div class="ip-item"><div class="ip-address">✗ Test failed</div><div class="ip-type">Error</div></div>';
        }
    }
    
    displayWebRTCIPRealtime(ipInfo) {
        const ipsContainer = document.getElementById('webrtc-ips');
        
        if (ipsContainer.querySelector('.skeleton-list')) {
            ipsContainer.innerHTML = '';
        }
        
        const existingIP = Array.from(ipsContainer.children).find(
            child => child.querySelector('.ip-address').textContent === ipInfo.ip
        );
        
        if (existingIP) {
            return;
        }
        
        const ipElement = document.createElement('div');
        ipElement.className = 'ip-item';
        ipElement.style.animation = 'fadeIn 0.5s ease';
        ipElement.innerHTML = `
            <div class="ip-address">${ipInfo.ip}</div>
            <div class="ip-type">${ipInfo.type}</div>
        `;
        
        ipsContainer.appendChild(ipElement);
    }
    
    displayWebRTCResults() {
        const ipsContainer = document.getElementById('webrtc-ips');
        ipsContainer.innerHTML = '';
        
        if (!this.webrtcIPs || this.webrtcIPs.length === 0) {
            ipsContainer.innerHTML = '<div class="ip-item"><div class="ip-address">✓ No IPs detected</div><div class="ip-type">Safe</div></div>';
            return;
        }
        
        this.webrtcIPs.forEach(ipObj => {
            const ipElement = document.createElement('div');
            ipElement.className = 'ip-item';
            ipElement.innerHTML = `
                <div class="ip-address">${ipObj.ip}</div>
                <div class="ip-type">${ipObj.type}</div>
            `;
            
            ipsContainer.appendChild(ipElement);
        });
    }
    
    async runDNSTest() {
        const statusEl = document.getElementById('dns-status');
        statusEl.innerHTML = '<span class="status-badge status-loading">Testing...</span>';
        
        const serversContainer = document.getElementById('dns-servers');
        serversContainer.innerHTML = '<div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
        
        try {
            this.dnsResults = await Tests.performDNSTest();
            
            this.displayDNSResults();
            
            const analysis = Tests.analyzeDNSResults(this.dnsResults);
            
            if (analysis.status === 'safe') {
                statusEl.innerHTML = '<span class="status-badge status-safe">✓ Safe</span>';
            } else if (analysis.status === 'warning') {
                statusEl.innerHTML = '<span class="status-badge status-leak">⚠ Warning</span>';
            } else {
                statusEl.innerHTML = '<span class="status-badge status-leak">✗ Error</span>';
            }
        } catch (error) {
            console.error('DNS test error:', error);
            statusEl.innerHTML = '<span class="status-badge status-leak">✗ Error</span>';
            serversContainer.innerHTML = '<div class="dns-item"><div class="dns-server">✗ Test failed</div></div>';
        }
    }
    
    displayDNSResults() {
        const serversContainer = document.getElementById('dns-servers');
        serversContainer.innerHTML = '';
        
        if (!this.dnsResults || this.dnsResults.length === 0) {
            serversContainer.innerHTML = '<div class="dns-item"><div class="dns-server">No DNS test results</div></div>';
            return;
        }
        
        this.dnsResults.forEach(result => {
            const dnsElement = document.createElement('div');
            dnsElement.className = 'dns-item';
            
            if (result.resolved) {
                dnsElement.innerHTML = `
                    <div class="dns-server">✓ ${result.domain}</div>
                    <div class="dns-info">
                        <span>Response Time: ${result.responseTime}ms</span>
                        <span>Status: Accessible</span>
                    </div>
                `;
            } else {
                dnsElement.innerHTML = `
                    <div class="dns-server">✗ ${result.domain}</div>
                    <div class="dns-info">
                        <span>Status: Not Accessible</span>
                        ${result.error ? `<span>Error: ${result.error}</span>` : ''}
                    </div>
                `;
            }
            
            serversContainer.appendChild(dnsElement);
        });
    }
    
    displayCloudflareData(data) {
        if (!data) {
            this.displayError('cloudflare');
            return;
        }
        
        const flag = CONFIG.getCountryFlag(data.countryCode);
        
        document.getElementById('cf-ip').textContent = data.ip;
        document.getElementById('cf-country').innerHTML = `<span class="country-flag">${flag}</span> ${data.country}`;
        document.getElementById('cf-city').textContent = data.city;
        document.getElementById('cf-isp').textContent = data.isp;
        document.getElementById('cf-region').textContent = data.region;
        document.getElementById('cf-timezone').textContent = data.timezone;
        document.getElementById('cf-postal').textContent = data.postal;
        document.getElementById('cf-coords').textContent = data.coords;
        document.getElementById('cf-asn').textContent = data.asn;
        
        this.cfMap = this.initMap('cf-map', data.coords);
    }
    
    displayOtherData(data) {
        if (!data) {
            this.displayError('other');
            return;
        }
        
        const flag = CONFIG.getCountryFlag(data.countryCode);
        
        document.getElementById('other-ip').textContent = data.ip;
        document.getElementById('other-country').innerHTML = `<span class="country-flag">${flag}</span> ${data.country}`;
        document.getElementById('other-city').textContent = data.city;
        document.getElementById('other-isp').textContent = data.isp;
        document.getElementById('other-region').textContent = data.region;
        document.getElementById('other-timezone').textContent = data.timezone;
        document.getElementById('other-postal').textContent = data.postal;
        document.getElementById('other-coords').textContent = data.coords;
        document.getElementById('other-asn').textContent = data.asn;
        
        this.otherMap = this.initMap('other-map', data.coords);
    }
    
    displayIPv6Data(data) {
        const flag = CONFIG.getCountryFlag(data.countryCode);
        
        document.getElementById('ipv6-ip').textContent = data.ip;
        document.getElementById('ipv6-country').innerHTML = `<span class="country-flag">${flag}</span> ${data.country}`;
        document.getElementById('ipv6-city').textContent = data.city;
        document.getElementById('ipv6-isp').textContent = data.isp;
    }
    
    displayIPv6Error() {
        ['ip', 'country', 'city', 'isp'].forEach(field => {
            document.getElementById(`ipv6-${field}`).textContent = 'N/A (IPv6 not detected)';
            document.getElementById(`ipv6-${field}`).style.color = '#f85149';
        });
    }
    
    initMap(mapId, coords) {
        if (coords === 'N/A') {
            document.getElementById(mapId).innerHTML = '<p>No coordinates available for mapping.</p>';
            return null;
        }
        
        const [lat, lng] = coords.split(', ').map(Number);
        const map = L.map(mapId).setView([lat, lng], 10);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        L.marker([lat, lng]).addTo(map)
            .bindPopup('Approximate Location')
            .openPopup();
        
        document.getElementById(mapId).style.display = 'block';
        
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
        
        return map;
    }
    
    showSkeletonLoading(target) {
        const prefix = target === 'cloudflare' ? 'cf' : 'other';
        const fields = ['ip', 'country', 'city', 'isp', 'region', 'timezone', 'postal', 'coords', 'asn'];
        
        fields.forEach(field => {
            const element = document.getElementById(`${prefix}-${field}`);
            if (element) {
                element.innerHTML = '<div class="skeleton"></div>';
            }
        });
    }
    
    displayError(target) {
        const prefix = target === 'cloudflare' ? 'cf' : 'other';
        const fields = ['ip', 'country', 'city', 'isp', 'region', 'timezone', 'postal', 'coords', 'asn'];
        
        fields.forEach(field => {
            const element = document.getElementById(`${prefix}-${field}`);
            if (element) {
                element.textContent = 'Error loading';
                element.style.color = '#f85149';
            }
        });
        
        document.getElementById(`${prefix}-map`).innerHTML = '<p>Error loading map.</p>';
    }
    
    compareResults() {
        if (!this.cloudflareData || !this.otherData) {
            this.updateStatus('warning', 'Incomplete data - Some services failed');
            return;
        }
        
        const comparison = Tests.compareIPs(this.cloudflareData.ip, this.otherData.ip);
        
        if (comparison.match) {
            this.updateStatus('success', 'Your IP is identical from both sources ✓');
        } else {
            this.updateStatus('warning', 'Warning: Your IP differs between sources!');
        }
        
        if (this.ipv6Data) {
            if (this.ipv6Data.ip !== this.otherData.ip) {
                this.updateStatus('warning', 'IPv6 detected and differs from IPv4!');
            }
        }
    }
    
    updateStatus(status, message) {
        const statusCard = document.getElementById('statusCard');
        const iconMap = {
            loading: '⏳',
            success: '✓',
            warning: '⚠',
            error: '✗'
        };
        
        statusCard.className = `status-card ${status}`;
        statusCard.innerHTML = `
            <div class="status-icon">${iconMap[status]}</div>
            <div class="status-text">${message}</div>
        `;
    }
    
    updateLastUpdateTime() {
        const now = new Date();
        
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        const dateString = `${year}-${month}-${day}`;
        const timeString = `${hours}:${minutes}:${seconds}`;
        
        document.getElementById('lastUpdate').innerHTML = `<span class="last-update-date">${dateString}</span> <span class="last-update-separator">at</span> <span class="last-update-time">${timeString}</span>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new IPLeakTester();
});