// Authentication Manager
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.currentProfile = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Check existing session
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            
            if (session) {
                await this.loadUserProfile(session.user);
            }
            
            this.isInitialized = true;
            
            // Listen for auth changes
            window.supabaseClient.auth.onAuthStateChange((event, session) => {
                this.handleAuthChange(event, session);
            });
            
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.handleAuthError(error);
        }
    }

    async handleAuthChange(event, session) {
        console.log('Auth state changed:', event);
        
        switch (event) {
            case 'SIGNED_IN':
                if (session?.user) {
                    await this.loadUserProfile(session.user);
                }
                break;
                
            case 'SIGNED_OUT':
                this.clearUserData();
                this.redirectToLogin();
                break;
                
            case 'USER_UPDATED':
                if (session?.user) {
                    await this.loadUserProfile(session.user);
                }
                break;
                
            case 'TOKEN_REFRESHED':
                // Token refreshed successfully
                break;
                
            case 'USER_DELETED':
                this.clearUserData();
                this.redirectToLogin();
                break;
        }
    }

    async loadUserProfile(user) {
        try {
            this.currentUser = user;
            
            // Get user profile from database
            const profile = await window.Database.getProfile(user.id);
            this.currentProfile = profile;
            
            // Store in localStorage for quick access
            localStorage.setItem('user_id', user.id);
            localStorage.setItem('user_email', user.email);
            localStorage.setItem('user_role', profile.role);
            localStorage.setItem('user_profile', JSON.stringify(profile));
            
            // Subscribe to realtime updates for this user
            this.subscribeToUserUpdates(user.id, profile.role);
            
            return profile;
            
        } catch (error) {
            console.error('Error loading user profile:', error);
            
            // If profile doesn't exist, create default
            if (error.code === 'PGRST116') { // Record not found
                return await this.createDefaultProfile(user);
            }
            
            throw error;
        }
    }

    async createDefaultProfile(user) {
        const defaultProfile = {
            id: user.id,
            email: user.email,
            full_name: user.email.split('@')[0].replace('.', ' '),
            role: 'Agent',
            work_type: 'shift',
            shift: 'Shift A',
            department: 'INR',
            production_line: 'Line 1',
            needs_setup: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            const { data: profile, error } = await window.supabaseClient
                .from('profiles')
                .insert([defaultProfile])
                .select()
                .single();

            if (error) throw error;

            this.currentProfile = profile;
            localStorage.setItem('user_profile', JSON.stringify(profile));
            
            return profile;
            
        } catch (error) {
            console.error('Error creating default profile:', error);
            throw error;
        }
    }

    async login(email, password) {
        try {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email: email.trim(),
                password: password
            });

            if (error) throw error;

            await this.loadUserProfile(data.user);
            
            return {
                success: true,
                user: this.currentProfile
            };
            
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: this.getAuthErrorMessage(error)
            };
        }
    }

    async signup(email, password, userData) {
        try {
            const { data, error } = await window.supabaseClient.auth.signUp({
                email: email.trim(),
                password: password,
                options: {
                    data: userData
                }
            });

            if (error) throw error;

            return {
                success: true,
                user: data.user
            };
            
        } catch (error) {
            console.error('Signup error:', error);
            return {
                success: false,
                error: this.getAuthErrorMessage(error)
            };
        }
    }

    async logout() {
        try {
            await window.Session.signOut();
            this.clearUserData();
            this.redirectToLogin();
            
        } catch (error) {
            console.error('Logout error:', error);
            // Force logout anyway
            this.clearUserData();
            this.redirectToLogin();
        }
    }

    async updateProfile(updates) {
        try {
            if (!this.currentUser) {
                throw new Error('No user logged in');
            }

            const updatedProfile = await window.Database.updateProfile(this.currentUser.id, updates);
            this.currentProfile = updatedProfile;
            
            localStorage.setItem('user_profile', JSON.stringify(updatedProfile));
            
            return {
                success: true,
                profile: updatedProfile
            };
            
        } catch (error) {
            console.error('Profile update error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async changePassword(currentPassword, newPassword) {
        try {
            const { error } = await window.supabaseClient.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            return { success: true };
            
        } catch (error) {
            console.error('Password change error:', error);
            return {
                success: false,
                error: this.getAuthErrorMessage(error)
            };
        }
    }

    async resetPassword(email) {
        try {
            const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password.html`
            });

            if (error) throw error;

            return { success: true };
            
        } catch (error) {
            console.error('Password reset error:', error);
            return {
                success: false,
                error: this.getAuthErrorMessage(error)
            };
        }
    }

    subscribeToUserUpdates(userId, role) {
        // Subscribe to profile updates
        window.Realtime.subscribe('profiles', 'UPDATE', (payload) => {
            if (payload.new.id === userId) {
                this.currentProfile = payload.new;
                localStorage.setItem('user_profile', JSON.stringify(payload.new));
                
                // Notify other components
                this.dispatchEvent('profileUpdated', payload.new);
            }
        }, { filter: `id=eq.${userId}` });

        // Subscribe to notifications based on role
        this.subscribeToNotifications(userId, role);
    }

    subscribeToNotifications(userId, role) {
        // Subscribe to general notifications
        window.Realtime.subscribe('notifications', 'INSERT', (payload) => {
            if (payload.new.target_user_id === userId || 
                payload.new.target_role === role) {
                this.dispatchEvent('newNotification', payload.new);
            }
        });
    }

    getAuthErrorMessage(error) {
        const messages = {
            'Invalid login credentials': 'Email ou mot de passe incorrect',
            'Email not confirmed': 'Veuillez confirmer votre email avant de vous connecter',
            'User already registered': 'Cet email est déjà utilisé',
            'Weak password': 'Le mot de passe doit contenir au moins 6 caractères',
            'Network request failed': 'Erreur réseau. Vérifiez votre connexion',
            'Auth session missing': 'Session expirée. Veuillez vous reconnecter',
            'Email rate limit exceeded': 'Trop de tentatives. Veuillez réessayer plus tard'
        };

        return messages[error.message] || error.message || 'Une erreur est survenue';
    }

    clearUserData() {
        this.currentUser = null;
        this.currentProfile = null;
        
        window.Realtime.unsubscribeAll();
        
        // Clear all auth-related storage
        const keysToKeep = ['language', 'theme'];
        Object.keys(localStorage).forEach(key => {
            if (!keysToKeep.includes(key) && key.startsWith('user_')) {
                localStorage.removeItem(key);
            }
        });
        
        sessionStorage.clear();
    }

    redirectToLogin() {
        // Don't redirect if already on login page
        if (window.location.pathname.includes('login.html')) {
            return;
        }
        
        // Save current path for return after login
        const returnTo = window.location.pathname + window.location.search;
        sessionStorage.setItem('returnTo', returnTo);
        
        window.location.href = 'login.html';
    }

    redirectToDashboard() {
        if (!this.currentProfile) {
            this.redirectToLogin();
            return;
        }

        const role = this.currentProfile.role;
        const needsSetup = this.currentProfile.needs_setup;

        const dashboardPaths = {
            'Agent': 'agent.html',
            'Chef d\'équipe': 'chef.html',
            'Superviseur': 'superviseur.html',
            'Sous-directeur': 'sousdir.html',
            'Directeur': 'directeur.html'
        };

        if (needsSetup) {
            window.location.href = 'setup.html';
        } else if (dashboardPaths[role]) {
            window.location.href = dashboardPaths[role];
        } else {
            console.error('Unknown role:', role);
            this.redirectToLogin();
        }
    }

    // Role-based permissions
    hasPermission(requiredRole) {
        if (!this.currentProfile) return false;
        
        const roleHierarchy = {
            'Agent': 1,
            'Chef d\'équipe': 2,
            'Superviseur': 3,
            'Sous-directeur': 4,
            'Directeur': 5
        };

        const userLevel = roleHierarchy[this.currentProfile.role] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;

        return userLevel >= requiredLevel;
    }

    canManageDepartment(department) {
        if (!this.currentProfile) return false;
        
        const role = this.currentProfile.role;
        
        switch (role) {
            case 'Directeur':
                return true; // Can manage all departments
                
            case 'Sous-directeur':
                return true; // Can manage all ZSB departments
                
            case 'Superviseur':
                const supervisedDepts = this.currentProfile.supervised_departments || [];
                return Array.isArray(supervisedDepts) && supervisedDepts.includes(department);
                
            case 'Chef d\'équipe':
                const managedDepts = this.currentProfile.managed_departments || [];
                return Array.isArray(managedDepts) && managedDepts.includes(department);
                
            default:
                return false;
        }
    }

    canManageUser(targetUserId, targetRole) {
        if (!this.currentProfile || !targetUserId) return false;
        
        // Can't manage yourself
        if (this.currentUser.id === targetUserId) return false;
        
        const roleHierarchy = {
            'Agent': 1,
            'Chef d\'équipe': 2,
            'Superviseur': 3,
            'Sous-directeur': 4,
            'Directeur': 5
        };

        const userLevel = roleHierarchy[this.currentProfile.role] || 0;
        const targetLevel = roleHierarchy[targetRole] || 0;

        // Can only manage users with lower or equal role level
        return userLevel > targetLevel;
    }

    // Event system for component communication
    eventListeners = new Map();

    addEventListener(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }

    removeEventListener(event, callback) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).delete(callback);
        }
    }

    dispatchEvent(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            });
        }
    }

    // Getters
    getUser() {
        return this.currentUser;
    }

    getProfile() {
        return this.currentProfile;
    }

    getRole() {
        return this.currentProfile?.role;
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    needsSetup() {
        return this.currentProfile?.needs_setup === true;
    }
}

// Initialize Auth Manager
window.authManager = new AuthManager();

// Auto-check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Skip check for login and setup pages
    const currentPage = window.location.pathname;
    if (currentPage.includes('login.html') || currentPage.includes('setup.html')) {
        return;
    }
    
    // Check if user is authenticated
    if (!window.authManager.isAuthenticated()) {
        window.authManager.redirectToLogin();
        return;
    }
    
    // Check if user needs setup
    if (window.authManager.needsSetup() && !currentPage.includes('setup.html')) {
        window.location.href = 'setup.html';
        return;
    }
    
    // Check role-based page access
    const userRole = window.authManager.getRole();
    const currentRolePage = currentPage.split('/').pop().replace('.html', '');
    
    const rolePages = {
        'agent': ['Agent'],
        'chef': ['Chef d\'équipe'],
        'superviseur': ['Superviseur'],
        'sousdir': ['Sous-directeur', 'Directeur'],
        'directeur': ['Directeur']
    };
    
    let hasAccess = false;
    for (const [page, roles] of Object.entries(rolePages)) {
        if (currentRolePage === page && roles.includes(userRole)) {
            hasAccess = true;
            break;
        }
    }
    
    if (!hasAccess && currentRolePage !== 'index') {
        // Redirect to appropriate dashboard
        window.authManager.redirectToDashboard();
    }
});
