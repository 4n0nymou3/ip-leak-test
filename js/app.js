class IPLeakTester {
    constructor() {
        this.cloudflareData = null;
        this.otherData = null;
        this.ipv6Data = null;
        this.webrtcIPs = [];
        this.dnsResults = [];
        this.fingerprintResults = null;
        this.timezoneResults = null;
        this.portResults = [];
        this.workerDNSResults = null;
        this.workerProxyResults = null;
        this.isLoading = false;
        this.testStartTime = null;
        this.cfMap = null;
        this.otherMap = null;
        this.totalTests = 10;
        this.completedTests = 0;
        
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
        this.fingerprintResults = null;
        this.timezoneResults = null;
        this.portResults = [];
        this.workerDNSResults = null;
        this.workerProxyResults = null;
        this.completedTests = 0;
        
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
        
        document.getElementById('fingerprint-status').innerHTML = '<span class="status-badge status-loading">Testing...</span>';
        document.getElementById('fingerprint-results').innerHTML = '<div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
        
        document.getElementById('timezone-status').innerHTML = '<span class="status-badge status-loading">Testing...</span>';
        document.getElementById('timezone-results').innerHTML = '<div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div></div>';
        
        document.getElementById('port-status').innerHTML = '<span class="status-badge status-loading">Testing...</span>';
        document.getElementById('port-results').innerHTML = '<div class="skeleton-list"><div class="skeleton"></div></div>';
        
        if (CONFIG.worker.enabled) {
            document.getElementById('worker-dns-status').innerHTML = '<span class="status-badge status-loading">Testing...</span>';
            document.getElementById('worker-dns-results').innerHTML = '<div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div></div>';
            
            document.getElementById('proxy-status').innerHTML = '<span class="status-badge status-loading">Testing...</span>';
            document.getElementById('proxy-results').innerHTML = '<div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
        } else {
            document.getElementById('worker-dns-box').style.display = 'none';
        }
        
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
            dns: this.dnsResults,
            fingerprint: this.fingerprintResults,
            timezone: this.timezoneResults,
            ports: this.portResults,
            workerDNS: this.workerDNSResults,
            workerProxy: this.workerProxyResults,
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().split('T')[0];
        a.download = `ip-leak-test-${timestamp}.json`;
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
    
    updateProgress(completed) {
        this.completedTests = completed;
        const percentage = Math.round((completed / this.totalTests) * 100);
        
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const progressContainer = document.getElementById('progressBarContainer');
        
        progressContainer.classList.add('active');
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
        
        if (completed >= this.totalTests) {
            setTimeout(() => {
                progressContainer.classList.remove('active');
            }, 1000);
        }
    }
    
    async startInitialTests() {
        if (this.isLoading) {
            console.log('Tests already running...');
            return;
        }
        
        this.isLoading = true;
        this.testStartTime = Date.now();
        this.completedTests = 0;
        this.updateStatus('loading', 'Running security tests...');
        this.updateProgress(0);
        
        try {
            const cloudflarePromise = API.fetchWithRetry(() => API.fetchCloudflareData()).then(result => {
                this.cloudflareData = result;
                this.updateProgress(++this.completedTests);
                if (result) {
                    this.displayCloudflareData(result);
                } else {
                    this.displayError('cloudflare');
                }
                return result;
            });
            
            const ipifyPromise = API.fetchWithRetry(() => API.fetchIpifyData()).then(result => {
                this.otherData = result;
                this.updateProgress(++this.completedTests);
                if (result) {
                    this.displayOtherData(result);
                } else {
                    this.displayError('other');
                }
                return result;
            });
            
            const ipv6Promise = API.fetchWithRetry(() => API.fetchIPv6Data()).then(result => {
                this.ipv6Data = result;
                this.updateProgress(++this.completedTests);
                if (result) {
                    this.displayIPv6Data(result);
                } else {
                    this.displayIPv6Error();
                }
                return result;
            });
            
            await Promise.all([cloudflarePromise, ipifyPromise, ipv6Promise]);
            
            const webrtcPromise = this.runWebRTCTest().then(result => {
                this.updateProgress(++this.completedTests);
                return result;
            });
            
            const dnsPromise = this.runDNSTest().then(result => {
                this.updateProgress(++this.completedTests);
                return result;
            });
            
            const fingerprintPromise = this.runFingerprintTest().then(result => {
                this.updateProgress(++this.completedTests);
                return result;
            });
            
            const timezonePromise = this.runTimezoneTest().then(result => {
                this.updateProgress(++this.completedTests);
                return result;
            });
            
            const portPromise = this.runPortScanTest().then(result => {
                this.updateProgress(++this.completedTests);
                return result;
            });
            
            const workerDNSPromise = this.runWorkerDNSTest().then(result => {
                this.updateProgress(++this.completedTests);
                return result;
            });
            
            const workerProxyPromise = this.runWorkerProxyTest().then(result => {
                this.updateProgress(++this.completedTests);
                return result;
            });
            
            await Promise.all([
                webrtcPromise,
                dnsPromise,
                fingerprintPromise,
                timezonePromise,
                portPromise,
                workerDNSPromise,
                workerProxyPromise
            ]);
            
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
            child => child.querySelector('.ip-address') && child.querySelector('.ip-address').textContent === ipInfo.ip
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
                dnsElement.classList.add('dns-success');
                dnsElement.innerHTML = `
                    <div class="dns-header">
                        <div class="dns-server">
                            <span class="dns-icon dns-icon-success">✓</span>
                            ${result.domain}
                        </div>
                        <span class="dns-badge dns-badge-success">Accessible</span>
                    </div>
                    <div class="dns-info">
                        <span class="dns-metric"><span class="dns-metric-label">Response Time:</span> ${result.responseTime}ms</span>
                    </div>
                `;
            } else {
                dnsElement.classList.add('dns-error');
                dnsElement.innerHTML = `
                    <div class="dns-header">
                        <div class="dns-server">
                            <span class="dns-icon dns-icon-error">✗</span>
                            ${result.domain}
                        </div>
                        <span class="dns-badge dns-badge-error">Not Accessible</span>
                    </div>
                    <div class="dns-info">
                        ${result.error ? `<span class="dns-metric"><span class="dns-metric-label">Error:</span> ${result.error}</span>` : ''}
                    </div>
                `;
            }
            
            serversContainer.appendChild(dnsElement);
        });
    }
    
    async runFingerprintTest() {
        const statusEl = document.getElementById('fingerprint-status');
        statusEl.innerHTML = '<span class="status-badge status-loading">Testing...</span>';
        
        const resultsContainer = document.getElementById('fingerprint-results');
        resultsContainer.innerHTML = '<div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
        
        try {
            this.fingerprintResults = await FingerprintTests.performFingerprintTest();
            
            this.displayFingerprintResults();
            
            statusEl.innerHTML = '<span class="status-badge status-leak">⚠ Detectable</span>';
        } catch (error) {
            console.error('Fingerprint test error:', error);
            statusEl.innerHTML = '<span class="status-badge status-leak">✗ Error</span>';
            resultsContainer.innerHTML = '<div class="fingerprint-item"><div class="fingerprint-label">✗ Test failed</div></div>';
        }
    }
    
    displayFingerprintResults() {
        const resultsContainer = document.getElementById('fingerprint-results');
        resultsContainer.innerHTML = '';
        
        if (!this.fingerprintResults) {
            resultsContainer.innerHTML = '<div class="fingerprint-item"><div class="fingerprint-label">No results</div></div>';
            return;
        }
        
        const items = [
            { label: 'Canvas Fingerprint', value: this.fingerprintResults.canvas.detected ? `Hash: ${this.fingerprintResults.canvas.hash}` : 'Not detected' },
            { label: 'WebGL Renderer', value: this.fingerprintResults.webgl.detected ? `${this.fingerprintResults.webgl.renderer}` : 'Not available' },
            { label: 'Fonts Detected', value: `${this.fingerprintResults.fonts.count} fonts: ${this.fingerprintResults.fonts.fonts}` },
            { label: 'Screen Resolution', value: `${this.fingerprintResults.screen.resolution} (${this.fingerprintResults.screen.colorDepth})` },
            { label: 'Platform', value: this.fingerprintResults.platform.platform },
            { label: 'Languages', value: this.fingerprintResults.languages.all },
            { label: 'Hardware Cores', value: this.fingerprintResults.hardware.cores },
            { label: 'Device Memory', value: this.fingerprintResults.hardware.memory },
            { label: 'Touch Support', value: this.fingerprintResults.hardware.touchSupport ? 'Yes' : 'No' },
            { label: 'Connection Type', value: this.fingerprintResults.connection.detected ? this.fingerprintResults.connection.type : 'Not Available' },
            { label: 'Connection Speed', value: this.fingerprintResults.connection.detected ? `${this.fingerprintResults.connection.downlink} (RTT: ${this.fingerprintResults.connection.rtt})` : 'Not Available' },
            { label: 'Battery Level', value: this.fingerprintResults.battery.level },
            { label: 'Battery Charging', value: this.fingerprintResults.battery.charging },
            { label: 'Do Not Track', value: this.fingerprintResults.doNotTrack.status }
        ];
        
        items.forEach(item => {
            const element = document.createElement('div');
            element.className = 'fingerprint-item';
            element.innerHTML = `
                <div class="fingerprint-label">${item.label}</div>
                <div class="fingerprint-value">${item.value}</div>
            `;
            resultsContainer.appendChild(element);
        });
    }
    
    async runTimezoneTest() {
        const statusEl = document.getElementById('timezone-status');
        statusEl.innerHTML = '<span class="status-badge status-loading">Testing...</span>';
        
        const resultsContainer = document.getElementById('timezone-results');
        resultsContainer.innerHTML = '<div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div></div>';
        
        try {
            const ipCountry = this.cloudflareData ? this.cloudflareData.country : (this.otherData ? this.otherData.country : null);
            const ipCity = this.cloudflareData ? this.cloudflareData.city : (this.otherData ? this.otherData.city : null);
            
            console.log('Timezone Test - IP Country:', ipCountry);
            console.log('Timezone Test - IP City:', ipCity);
            
            this.timezoneResults = await FingerprintTests.performTimezoneTest(ipCountry, ipCity);
            
            console.log('Timezone Test Results:', this.timezoneResults);
            
            this.displayTimezoneResults();
            
            if (this.timezoneResults.leakDetected) {
                statusEl.innerHTML = '<span class="status-badge status-leak">⚠ Leak Detected</span>';
            } else {
                statusEl.innerHTML = '<span class="status-badge status-safe">✓ Normal</span>';
            }
        } catch (error) {
            console.error('Timezone test error:', error);
            statusEl.innerHTML = '<span class="status-badge status-leak">✗ Error</span>';
            resultsContainer.innerHTML = '<div class="timezone-item"><div class="timezone-label">✗ Test failed</div></div>';
        }
    }
    
    displayTimezoneResults() {
        const resultsContainer = document.getElementById('timezone-results');
        resultsContainer.innerHTML = '';
        
        if (!this.timezoneResults) {
            resultsContainer.innerHTML = '<div class="timezone-item"><div class="timezone-label">No results</div></div>';
            return;
        }
        
        const items = [
            { label: 'Timezone', value: this.timezoneResults.timezone },
            { label: 'UTC Offset', value: this.timezoneResults.offset },
            { label: 'Browser Time', value: this.timezoneResults.browserTime }
        ];
        
        if (this.timezoneResults.leakDetected && this.timezoneResults.leakReason) {
            items.push({ label: '⚠ Leak Detected', value: this.timezoneResults.leakReason });
        }
        
        items.forEach(item => {
            const element = document.createElement('div');
            element.className = 'timezone-item';
            if (item.label.includes('⚠')) {
                element.style.borderLeft = '3px solid #da3633';
            }
            element.innerHTML = `
                <div class="timezone-label">${item.label}</div>
                <div class="timezone-value">${item.value}</div>
            `;
            resultsContainer.appendChild(element);
        });
    }
    
    async runPortScanTest() {
        const statusEl = document.getElementById('port-status');
        statusEl.innerHTML = '<span class="status-badge status-loading">Testing...</span>';
        
        const resultsContainer = document.getElementById('port-results');
        resultsContainer.innerHTML = '<div class="skeleton-list"><div class="skeleton"></div></div>';
        
        try {
            this.portResults = await FingerprintTests.performPortScanTest();
            
            this.displayPortResults();
            
            const openPorts = this.portResults.filter(p => p.status === 'Potentially Open').length;
            if (openPorts > 0) {
                statusEl.innerHTML = '<span class="status-badge status-leak">⚠ Ports Detected</span>';
            } else {
                statusEl.innerHTML = '<span class="status-badge status-safe">✓ Secure</span>';
            }
        } catch (error) {
            console.error('Port scan test error:', error);
            statusEl.innerHTML = '<span class="status-badge status-leak">✗ Error</span>';
            resultsContainer.innerHTML = '<div class="port-item"><div class="port-label">✗ Test failed</div></div>';
        }
    }
    
    displayPortResults() {
        const resultsContainer = document.getElementById('port-results');
        resultsContainer.innerHTML = '';
        
        if (!this.portResults || this.portResults.length === 0) {
            resultsContainer.innerHTML = '<div class="port-item"><div class="port-label">No results</div></div>';
            return;
        }
        
        this.portResults.forEach(result => {
            const element = document.createElement('div');
            element.className = 'port-item';
            element.innerHTML = `
                <div class="port-label">Port ${result.port}</div>
                <div class="port-status">${result.status}</div>
            `;
            resultsContainer.appendChild(element);
        });
    }
    
    async runWorkerDNSTest() {
        if (!CONFIG.worker.enabled) {
            document.getElementById('worker-dns-box').style.display = 'none';
            return;
        }
        
        const statusEl = document.getElementById('worker-dns-status');
        statusEl.innerHTML = '<span class="status-badge status-loading">Testing...</span>';
        
        const resultsContainer = document.getElementById('worker-dns-results');
        resultsContainer.innerHTML = '<div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div></div>';
        
        try {
            this.workerDNSResults = await API.fetchWorkerDNSLeak();
            
            if (this.workerDNSResults) {
                this.displayWorkerDNSResults();
                
                if (this.workerDNSResults.leakDetected) {
                    statusEl.innerHTML = '<span class="status-badge status-leak">⚠ Leak Detected</span>';
                } else {
                    statusEl.innerHTML = '<span class="status-badge status-safe">✓ Safe</span>';
                }
            } else {
                statusEl.innerHTML = '<span class="status-badge status-leak">✗ Error</span>';
                resultsContainer.innerHTML = '<div class="dns-item"><div class="dns-server">Worker API not available</div></div>';
            }
        } catch (error) {
            console.error('Worker DNS test error:', error);
            statusEl.innerHTML = '<span class="status-badge status-leak">✗ Error</span>';
            resultsContainer.innerHTML = '<div class="dns-item"><div class="dns-server">✗ Test failed</div></div>';
        }
    }
    
    displayWorkerDNSResults() {
        const resultsContainer = document.getElementById('worker-dns-results');
        resultsContainer.innerHTML = '';
        
        if (!this.workerDNSResults) {
            resultsContainer.innerHTML = '<div class="dns-item"><div class="dns-server">No results</div></div>';
            return;
        }
        
        const items = [
            { label: 'Your IP', value: this.workerDNSResults.clientIP, icon: '🌐' },
            { label: 'DNS Resolver IP', value: this.workerDNSResults.dnsResolver, icon: '🔍' },
            { label: 'ASN Organization', value: this.workerDNSResults.asnOrg, icon: '🏢' },
            { label: 'Cloudflare Datacenter', value: this.workerDNSResults.colo, icon: '📡' }
        ];
        
        if (this.workerDNSResults.leakDetected && this.workerDNSResults.leakReason) {
            items.push({ 
                label: 'Leak Detected', 
                value: this.workerDNSResults.leakReason, 
                icon: '⚠',
                isWarning: true 
            });
        }
        
        items.forEach(item => {
            const element = document.createElement('div');
            element.className = 'dns-item';
            if (item.isWarning) {
                element.classList.add('dns-error');
            }
            element.innerHTML = `
                <div class="dns-header">
                    <div class="dns-server">
                        <span class="dns-icon-emoji">${item.icon}</span>
                        ${item.label}
                    </div>
                    ${item.isWarning ? '<span class="dns-badge dns-badge-error">Warning</span>' : ''}
                </div>
                <div class="dns-info">
                    <span class="dns-value">${item.value}</span>
                </div>
            `;
            resultsContainer.appendChild(element);
        });
    }
    
    async runWorkerProxyTest() {
        if (!CONFIG.worker.enabled) {
            return;
        }
        
        const statusEl = document.getElementById('proxy-status');
        statusEl.innerHTML = '<span class="status-badge status-loading">Testing...</span>';
        
        const resultsContainer = document.getElementById('proxy-results');
        resultsContainer.innerHTML = '<div class="skeleton-list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
        
        try {
            this.workerProxyResults = await API.fetchWorkerProxyDetection();
            
            if (this.workerProxyResults) {
                this.displayWorkerProxyResults();
                
                if (this.workerProxyResults.isProxyLikely) {
                    if (this.workerProxyResults.isTor) {
                        statusEl.innerHTML = '<span class="status-badge status-leak">⚠ Tor Detected</span>';
                    } else if (this.workerProxyResults.isVPN) {
                        statusEl.innerHTML = '<span class="status-badge status-leak">⚠ VPN Detected</span>';
                    } else if (this.workerProxyResults.isDatacenter) {
                        statusEl.innerHTML = '<span class="status-badge status-leak">⚠ Datacenter IP</span>';
                    } else {
                        statusEl.innerHTML = '<span class="status-badge status-leak">⚠ Proxy Detected</span>';
                    }
                } else {
                    statusEl.innerHTML = '<span class="status-badge status-safe">✓ Direct Connection</span>';
                }
            } else {
                statusEl.innerHTML = '<span class="status-badge status-leak">✗ Error</span>';
                resultsContainer.innerHTML = '<div class="fingerprint-item"><div class="fingerprint-label">Worker API not available</div></div>';
            }
        } catch (error) {
            console.error('Worker Proxy test error:', error);
            statusEl.innerHTML = '<span class="status-badge status-leak">✗ Error</span>';
            resultsContainer.innerHTML = '<div class="fingerprint-item"><div class="fingerprint-label">✗ Test failed</div></div>';
        }
    }
    
    displayWorkerProxyResults() {
        const resultsContainer = document.getElementById('proxy-results');
        resultsContainer.innerHTML = '';
        
        if (!this.workerProxyResults) {
            resultsContainer.innerHTML = '<div class="fingerprint-item"><div class="fingerprint-label">No results</div></div>';
            return;
        }
        
        const items = [
            { label: 'IP Address', value: this.workerProxyResults.ip },
            { label: 'Risk Level', value: this.workerProxyResults.risk },
            { label: 'Is Tor', value: this.workerProxyResults.isTor ? 'Yes' : 'No' },
            { label: 'Is VPN', value: this.workerProxyResults.isVPN ? 'Yes' : 'No' },
            { label: 'Is Datacenter', value: this.workerProxyResults.isDatacenter ? 'Yes' : 'No' },
            { label: 'ASN', value: `${this.workerProxyResults.asn} - ${this.workerProxyResults.asnOrg}` },
            { label: 'Country', value: this.workerProxyResults.country }
        ];
        
        if (this.workerProxyResults.proxyIndicators && this.workerProxyResults.proxyIndicators.length > 0) {
            items.push({ 
                label: 'Detection Indicators', 
                value: this.workerProxyResults.proxyIndicators.join(', '),
                isWarning: true
            });
        }
        
        items.forEach(item => {
            const element = document.createElement('div');
            element.className = 'fingerprint-item';
            if (item.isWarning) {
                element.style.borderLeft = '3px solid #da3633';
            }
            element.innerHTML = `
                <div class="fingerprint-label">${item.label}</div>
                <div class="fingerprint-value">${item.value}</div>
            `;
            resultsContainer.appendChild(element);
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