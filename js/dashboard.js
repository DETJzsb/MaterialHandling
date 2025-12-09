// Dashboard Utility Functions
class DashboardManager {
    constructor() {
        this.currentTab = 'overview';
        this.refreshInterval = null;
        this.isInitialized = false;
        this.charts = new Map();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Load user data
            await this.loadUserData();
            
            // Initialize dashboard components
            this.initSidebar();
            this.initTabs();
            this.initCharts();
            this.initEventListeners();
            
            // Start auto-refresh
            this.startAutoRefresh();
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            this.showError('Erreur d\'initialisation du tableau de bord');
        }
    }

    async loadUserData() {
        try {
            const profile = window.authManager.getProfile();
            if (!profile) {
                throw new Error('User profile not found');
            }
            
            this.userProfile = profile;
            this.updateUserUI();
            
            // Load dashboard-specific data
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Error loading user data:', error);
            throw error;
        }
    }

    updateUserUI() {
        // Update user name
        const nameElements = document.querySelectorAll('#agentName, #chefName, #supervisorName, #directorName');
        nameElements.forEach(el => {
            if (el) el.textContent = this.userProfile.full_name || 'Utilisateur';
        });
        
        // Update role badge
        const roleBadges = document.querySelectorAll('.role-badge');
        roleBadges.forEach(el => {
            if (el) {
                el.textContent = this.userProfile.role;
                el.className = `role-badge ${this.userProfile.role.toLowerCase().replace(/\s+/g, '-')}`;
            }
        });
        
        // Update department info
        if (this.userProfile.department) {
            const deptElements = document.querySelectorAll('.department-info');
            deptElements.forEach(el => {
                if (el) el.textContent = this.userProfile.department;
            });
        }
        
        // Update shift info
        if (this.userProfile.shift) {
            const shiftElements = document.querySelectorAll('.shift-info');
            shiftElements.forEach(el => {
                if (el) el.textContent = this.userProfile.shift;
            });
        }
    }

    async loadDashboardData() {
        try {
            const role = this.userProfile.role;
            let endpoint = '';
            let data = {};
            
            switch (role) {
                case 'Agent':
                    endpoint = 'get-agent-dashboard';
                    data = { agent_id: this.userProfile.id };
                    break;
                    
                case 'Chef d\'équipe':
                    endpoint = 'get-chef-dashboard';
                    data = { chef_id: this.userProfile.id };
                    break;
                    
                case 'Superviseur':
                    endpoint = 'get-supervisor-dashboard';
                    data = { supervisor_id: this.userProfile.id };
                    break;
                    
                case 'Sous-directeur':
                case 'Directeur':
                    endpoint = 'get-director-dashboard';
                    data = { director_id: this.userProfile.id };
                    break;
            }
            
            if (endpoint) {
                const response = await window.callEdgeFunction(endpoint, data);
                if (response.success) {
                    this.updateDashboard(response.data);
                }
            }
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    updateDashboard(data) {
        // Update stats
        if (data.stats) {
            this.updateStats(data.stats);
        }
        
        // Update charts
        if (data.charts) {
            this.updateCharts(data.charts);
        }
        
        // Update tables
        if (data.tables) {
            this.updateTables(data.tables);
        }
        
        // Update notifications
        if (data.notifications) {
            this.updateNotifications(data.notifications);
        }
    }

    updateStats(stats) {
        // Production stats
        if (stats.production) {
            const prodEl = document.getElementById('todayProduction');
            if (prodEl) prodEl.textContent = stats.production.today || 0;
            
            const targetEl = document.getElementById('productionTarget');
            if (targetEl) targetEl.textContent = `Objectif: ${stats.production.target || 0}`;
            
            const progressEl = document.getElementById('productionProgress');
            if (progressEl && stats.production.target && stats.production.today) {
                const percentage = (stats.production.today / stats.production.target) * 100;
                progressEl.style.width = `${Math.min(percentage, 100)}%`;
            }
        }
        
        // Quality stats
        if (stats.quality) {
            const qualityEl = document.getElementById('qualityRate');
            if (qualityEl) qualityEl.textContent = `${stats.quality.rate || 0}%`;
            
            const trendEl = document.getElementById('qualityTrend');
            if (trendEl && stats.quality.trend) {
                trendEl.textContent = `${stats.quality.trend > 0 ? '+' : ''}${stats.quality.trend}%`;
                trendEl.className = `stat-trend ${stats.quality.trend >= 0 ? 'positive' : 'negative'}`;
            }
        }
        
        // Efficiency stats
        if (stats.efficiency) {
            const effEl = document.getElementById('efficiencyRate');
            if (effEl) effEl.textContent = `${stats.efficiency.rate || 0}%`;
            
            const timeEl = document.getElementById('productiveTime');
            if (timeEl && stats.efficiency.productive_time) {
                timeEl.textContent = stats.efficiency.productive_time;
            }
        }
        
        // Ranking
        if (stats.ranking) {
            const rankEl = document.getElementById('ranking');
            if (rankEl) rankEl.textContent = `#${stats.ranking.position || 0}`;
            
            const totalEl = document.getElementById('totalAgents');
            if (totalEl) totalEl.textContent = stats.ranking.total || 0;
        }
    }

    updateCharts(chartData) {
        // Production chart
        if (chartData.production && this.charts.has('production')) {
            const chart = this.charts.get('production');
            chart.data = chartData.production;
            chart.update();
        }
        
        // Quality chart
        if (chartData.quality && this.charts.has('quality')) {
            const chart = this.charts.get('quality');
            chart.data = chartData.quality;
            chart.update();
        }
        
        // Department chart
        if (chartData.department && this.charts.has('department')) {
            const chart = this.charts.get('department');
            chart.data = chartData.department;
            chart.update();
        }
    }

    updateTables(tableData) {
        // Production table
        if (tableData.production) {
            this.updateProductionTable(tableData.production);
        }
        
        // Tasks table
        if (tableData.tasks) {
            this.updateTasksTable(tableData.tasks);
        }
        
        // Issues table
        if (tableData.issues) {
            this.updateIssuesTable(tableData.issues);
        }
    }

    updateProductionTable(data) {
        const tbody = document.getElementById('productionHistory');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        data.forEach(item => {
            const row = document.createElement('tr');
            
            // Determine status class
            let statusClass = '';
            let statusText = '';
            
            switch (item.status) {
                case 'completed':
                    statusClass = 'status-success';
                    statusText = 'Terminé';
                    break;
                case 'in_progress':
                    statusClass = 'status-warning';
                    statusText = 'En cours';
                    break;
                case 'defect':
                    statusClass = 'status-danger';
                    statusText = 'Défaut';
                    break;
                default:
                    statusClass = 'status-info';
                    statusText = 'Planifié';
            }
            
            row.innerHTML = `
                <td>${item.time}</td>
                <td>${item.reference}</td>
                <td>${item.quantity}</td>
                <td>${item.cycle_time}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn-icon" onclick="viewProductionDetail('${item.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    updateNotifications(notifications) {
        const container = document.getElementById('notificationsList');
        const countElement = document.getElementById('notificationCount');
        
        if (!container || !countElement) return;
        
        container.innerHTML = '';
        let unreadCount = 0;
        
        notifications.forEach(notif => {
            const notifElement = document.createElement('div');
            notifElement.className = `notification-item ${notif.type} ${notif.read ? 'read' : 'unread'}`;
            notifElement.innerHTML = `
                <div class="notification-icon">
                    <i class="fas fa-${this.getNotificationIcon(notif.type)}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notif.title}</div>
                    <div class="notification-text">${notif.message}</div>
                    <div class="notification-time">${notif.time}</div>
                </div>
                ${!notif.read ? `
                <button class="notification-dismiss" onclick="markNotificationAsRead('${notif.id}')">
                    <i class="fas fa-times"></i>
                </button>
                ` : ''}
            `;
            
            container.appendChild(notifElement);
            
            if (!notif.read) unreadCount++;
        });
        
        countElement.textContent = unreadCount;
        countElement.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    getNotificationIcon(type) {
        const icons = {
            'info': 'info-circle',
            'success': 'check-circle',
            'warning': 'exclamation-triangle',
            'danger': 'exclamation-circle',
            'production': 'industry',
            'quality': 'clipboard-check',
            'maintenance': 'tools',
            'shift': 'clock'
        };
        
        return icons[type] || 'bell';
    }

    initSidebar() {
        const sidebarToggle = document.querySelector('.sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                document.querySelector('.dashboard-sidebar').classList.toggle('collapsed');
            });
        }
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (event) => {
            const sidebar = document.querySelector('.dashboard-sidebar');
            const toggleBtn = document.querySelector('.sidebar-toggle');
            
            if (window.innerWidth <= 1024 && 
                sidebar && 
                !sidebar.contains(event.target) && 
                !toggleBtn?.contains(event.target) &&
                sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
            }
        });
    }

    initTabs() {
        // Set active tab from URL hash
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            this.switchTab(hash);
        }
        
        // Add hash change listener
        window.addEventListener('hashchange', () => {
            const newHash = window.location.hash.replace('#', '');
            if (newHash && newHash !== this.currentTab) {
                this.switchTab(newHash);
            }
        });
    }

    switchTab(tabName) {
        // Don't switch if already on this tab
        if (tabName === this.currentTab) return;
        
        // Hide all tabs
        document.querySelectorAll('.content-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active class from all sidebar items
        document.querySelectorAll('.sidebar-menu li').forEach(item => {
            item.classList.remove('active');
        });
        
        // Show selected tab
        const tabElement = document.getElementById(tabName);
        if (tabElement) {
            tabElement.classList.add('active');
            this.currentTab = tabName;
            
            // Update URL hash
            window.location.hash = tabName;
            
            // Update sidebar active item
            const menuItem = document.querySelector(`.sidebar-menu a[href="#${tabName}"]`);
            if (menuItem) {
                menuItem.parentElement.classList.add('active');
            }
            
            // Load tab-specific data
            this.loadTabData(tabName);
        }
    }

    async loadTabData(tabName) {
        try {
            const role = this.userProfile.role;
            let endpoint = '';
            let data = {};
            
            switch (tabName) {
                case 'production':
                    endpoint = 'get-production-data';
                    data = { user_id: this.userProfile.id, period: 'today' };
                    break;
                    
                case 'quality':
                    endpoint = 'get-quality-data';
                    data = { user_id: this.userProfile.id };
                    break;
                    
                case 'tasks':
                    endpoint = 'get-tasks';
                    data = { user_id: this.userProfile.id };
                    break;
                    
                case 'reports':
                    endpoint = 'get-reports';
                    data = { user_id: this.userProfile.id };
                    break;
            }
            
            if (endpoint) {
                const response = await window.callEdgeFunction(endpoint, data);
                if (response.success) {
                    this.updateTabContent(tabName, response.data);
                }
            }
            
        } catch (error) {
            console.error(`Error loading ${tabName} data:`, error);
        }
    }

    updateTabContent(tabName, data) {
        switch (tabName) {
            case 'production':
                if (data.history) {
                    this.updateProductionTable(data.history);
                }
                if (data.chart) {
                    this.updateChart('production-detail', data.chart);
                }
                break;
                
            case 'quality':
                if (data.checks) {
                    this.updateQualityChecks(data.checks);
                }
                if (data.chart) {
                    this.updateChart('quality-detail', data.chart);
                }
                break;
                
            case 'tasks':
                if (data.tasks) {
                    this.updateTasksList(data.tasks);
                }
                break;
        }
    }

    initCharts() {
        // Initialize Chart.js defaults
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
            Chart.defaults.color = '#cbd5e1';
            Chart.defaults.plugins.legend.labels.color = '#94a3b8';
        }
        
        // Create production chart if element exists
        const productionCtx = document.getElementById('productionChart');
        if (productionCtx) {
            this.createProductionChart(productionCtx);
        }
        
        // Create quality chart if element exists
        const qualityCtx = document.getElementById('qualityChart');
        if (qualityCtx) {
            this.createQualityChart(qualityCtx);
        }
    }

    createProductionChart(ctx) {
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Production',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#cbd5e1',
                        borderColor: '#475569',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    }
                }
            }
        });
        
        this.charts.set('production', chart);
    }

    createQualityChart(ctx) {
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Taux de qualité',
                    data: [],
                    backgroundColor: '#3b82f6',
                    borderColor: '#2563eb',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
        
        this.charts.set('quality', chart);
    }

    updateChart(chartId, data) {
        if (this.charts.has(chartId)) {
            const chart = this.charts.get(chartId);
            chart.data.labels = data.labels || [];
            chart.data.datasets[0].data = data.values || [];
            chart.update();
        }
    }

    initEventListeners() {
        // Refresh button
        const refreshBtn = document.querySelector('[onclick="refreshData()"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshData());
        }
        
        // Clock in/out
        const clockBtn = document.querySelector('[onclick="clockInOut()"]');
        if (clockBtn) {
            clockBtn.addEventListener('click', () => this.clockInOut());
        }
        
        // Report issue
        const reportBtn = document.querySelector('[onclick="reportIssue()"]');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => this.reportIssue());
        }
        
        // Start production
        const startBtn = document.querySelector('[onclick="startProduction()"]');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startProduction());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl + R to refresh
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.refreshData();
            }
            
            // Ctrl + Shift + L to logout
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                this.logout();
            }
        });
    }

    async refreshData() {
        try {
            this.showLoading();
            await this.loadDashboardData();
            this.showSuccess('Données actualisées');
        } catch (error) {
            console.error('Refresh error:', error);
            this.showError('Erreur lors de l\'actualisation');
        } finally {
            this.hideLoading();
        }
    }

    async clockInOut() {
        try {
            const isClockedIn = await this.checkClockStatus();
            
            if (isClockedIn) {
                // Clock out
                const confirmed = confirm('Êtes-vous sûr de vouloir pointer la sortie ?');
                if (confirmed) {
                    await window.callEdgeFunction('clock-in-out', {
                        action: 'clock_out',
                        user_id: this.userProfile.id
                    });
                    
                    this.showSuccess('Pointage de sortie enregistré');
                    this.updateClockStatus(false);
                }
            } else {
                // Clock in
                await window.callEdgeFunction('clock-in-out', {
                    action: 'clock_in',
                    user_id: this.userProfile.id,
                    shift: this.userProfile.shift,
                    department: this.userProfile.department
                });
                
                this.showSuccess('Pointage d\'entrée enregistré');
                this.updateClockStatus(true);
            }
            
        } catch (error) {
            console.error('Clock in/out error:', error);
            this.showError('Erreur lors du pointage');
        }
    }

    async checkClockStatus() {
        try {
            const response = await window.callEdgeFunction('get-clock-status', {
                user_id: this.userProfile.id
            });
            
            return response.data?.is_clocked_in || false;
            
        } catch (error) {
            console.error('Clock status check error:', error);
            return false;
        }
    }

    updateClockStatus(isClockedIn) {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-indicator span:last-child');
        
        if (statusIndicator && statusDot && statusText) {
            if (isClockedIn) {
                statusDot.style.background = '#10b981';
                statusText.textContent = 'En production';
                statusIndicator.classList.add('active');
            } else {
                statusDot.style.background = '#ef4444';
                statusText.textContent = 'Hors production';
                statusIndicator.classList.remove('active');
            }
        }
    }

    async reportIssue() {
        const issueType = prompt('Type de problème:\n1. Technique\n2. Qualité\n3. Sécurité\n4. Matériel\n5. Autre');
        
        if (!issueType) return;
        
        const description = prompt('Description du problème:');
        if (!description) return;
        
        try {
            await window.callEdgeFunction('report-issue', {
                user_id: this.userProfile.id,
                type: issueType,
                description: description,
                department: this.userProfile.department,
                production_line: this.userProfile.production_line
            });
            
            this.showSuccess('Problème signalé avec succès');
            
        } catch (error) {
            console.error('Issue report error:', error);
            this.showError('Erreur lors du signalement');
        }
    }

    async startProduction() {
        try {
            const reference = prompt('Référence à produire:');
            if (!reference) return;
            
            const quantity = parseInt(prompt('Quantité:', '1'));
            if (!quantity || quantity < 1) return;
            
            await window.callEdgeFunction('start-production', {
                user_id: this.userProfile.id,
                reference: reference,
                quantity: quantity,
                production_line: this.userProfile.production_line
            });
            
            this.showSuccess('Production démarrée');
            this.refreshData();
            
        } catch (error) {
            console.error('Start production error:', error);
            this.showError('Erreur lors du démarrage');
        }
    }

    showLoading() {
        // Add loading overlay
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Chargement...</span>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.remove();
        }
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(toast);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
    }

    startAutoRefresh() {
        // Clear any existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.refreshData();
            }
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    logout() {
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            window.authManager.logout();
        }
    }

    // Cleanup
    destroy() {
        this.stopAutoRefresh();
        
        // Cleanup charts
        this.charts.forEach(chart => {
            chart.destroy();
        });
        this.charts.clear();
        
        this.isInitialized = false;
    }
}

// Initialize dashboard manager
window.dashboardManager = new DashboardManager();

// Global functions for HTML onclick handlers
window.switchTab = (tabName) => window.dashboardManager?.switchTab(tabName);
window.refreshData = () => window.dashboardManager?.refreshData();
window.clockInOut = () => window.dashboardManager?.clockInOut();
window.reportIssue = () => window.dashboardManager?.reportIssue();
window.startProduction = () => window.dashboardManager?.startProduction();
window.logout = () => window.dashboardManager?.logout();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.dashboardManager) {
        window.dashboardManager.init();
    }
});

// Cleanup when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.dashboardManager) {
        window.dashboardManager.destroy();
    }
});
