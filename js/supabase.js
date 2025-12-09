// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://arqzqflgzszfzwpvtkip.supabase.co',
    anonKey: 'sb_publishable_HEmQwOrXpJm38Y2d9_rD1Q_scpmFg0o'
};

// Initialize Supabase Client
const supabase = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
            storage: window.localStorage,
            storageKey: 'draexlmaier_auth'
        },
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    }
);

// Edge Functions Configuration
const EDGE_FUNCTIONS = {
    createUser: '/functions/v1/create-user',
    updateUser: '/functions/v1/update-user',
    assignLines: '/functions/v1/assign-lines',
    getDashboardData: '/functions/v1/get-dashboard-data',
    clockInOut: '/functions/v1/clock-in-out',
    reportProduction: '/functions/v1/report-production',
    getTeamData: '/functions/v1/get-team-data',
    getSupervisorData: '/functions/v1/get-supervisor-data',
    getDirectorData: '/functions/v1/get-director-data'
};

// Get Edge Function URL
function getEdgeFunctionUrl(functionName) {
    return `${SUPABASE_CONFIG.url}${EDGE_FUNCTIONS[functionName]}`;
}

// Call Edge Function
async function callEdgeFunction(functionName, data = {}, options = {}) {
    try {
        const token = localStorage.getItem('sb-auth-token') || 
                     localStorage.getItem('auth_token');
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(getEdgeFunctionUrl(functionName), {
            method: 'POST',
            headers,
            body: JSON.stringify(data),
            ...options
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `HTTP ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error(`Edge Function ${functionName} error:`, error);
        throw error;
    }
}

// Database Helper Functions
const Database = {
    // Profiles
    async getProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        return data;
    },
    
    async updateProfile(userId, updates) {
        const { data, error } = await supabase
            .from('profiles')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },
    
    // Production Data
    async getProductionData(agentId, date) {
        const { data, error } = await supabase
            .from('production_data')
            .select('*')
            .eq('agent_id', agentId)
            .eq('date', date)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        return data;
    },
    
    async addProductionRecord(record) {
        const { data, error } = await supabase
            .from('production_data')
            .insert({
                ...record,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },
    
    // Attendance
    async getAttendance(userId, date) {
        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },
    
    async clockIn(userId, data) {
        const { data: attendance, error } = await supabase
            .from('attendance')
            .upsert({
                user_id: userId,
                date: new Date().toISOString().split('T')[0],
                clock_in: new Date().toISOString(),
                ...data
            })
            .select()
            .single();
            
        if (error) throw error;
        return attendance;
    },
    
    async clockOut(userId) {
        const { data, error } = await supabase
            .from('attendance')
            .update({
                clock_out: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('date', new Date().toISOString().split('T')[0])
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },
    
    // Team Management
    async getTeamMembers(chefId) {
        const { data, error } = await supabase
            .from('team_assignments')
            .select(`
                agent:profiles(*),
                assignment_data
            `)
            .eq('chef_id', chefId)
            .eq('active', true);
            
        if (error) throw error;
        return data;
    },
    
    async assignAgentToTeam(chefId, agentId, data) {
        const { data: assignment, error } = await supabase
            .from('team_assignments')
            .upsert({
                chef_id: chefId,
                agent_id: agentId,
                assignment_data: data,
                assigned_at: new Date().toISOString(),
                active: true
            })
            .select()
            .single();
            
        if (error) throw error;
        return assignment;
    },
    
    // Issues & Reports
    async reportIssue(issue) {
        const { data, error } = await supabase
            .from('issues')
            .insert({
                ...issue,
                status: 'open',
                created_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (error) throw error;
        return data;
    },
    
    async getIssues(filters = {}) {
        let query = supabase
            .from('issues')
            .select('*')
            .order('created_at', { ascending: false });
            
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined) {
                query = query.eq(key, value);
            }
        });
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    
    // Analytics
    async getDepartmentStats(department, period = 'today') {
        const { data, error } = await supabase.rpc('get_department_stats', {
            p_department: department,
            p_period: period
        });
        
        if (error) throw error;
        return data;
    },
    
    async getProductionStats(params) {
        const { data, error } = await supabase.rpc('get_production_stats', params);
        
        if (error) throw error;
        return data;
    }
};

// Realtime Subscriptions
const Realtime = {
    subscriptions: new Map(),
    
    subscribe(table, event, callback, filters = {}) {
        const subscription = supabase
            .channel(`${table}-changes`)
            .on(
                'postgres_changes',
                {
                    event,
                    schema: 'public',
                    table,
                    ...filters
                },
                callback
            )
            .subscribe();
            
        this.subscriptions.set(`${table}-${event}`, subscription);
        return subscription;
    },
    
    unsubscribe(table, event) {
        const key = `${table}-${event}`;
        const subscription = this.subscriptions.get(key);
        if (subscription) {
            supabase.removeChannel(subscription);
            this.subscriptions.delete(key);
        }
    },
    
    unsubscribeAll() {
        this.subscriptions.forEach(subscription => {
            supabase.removeChannel(subscription);
        });
        this.subscriptions.clear();
    }
};

// Session Management
const Session = {
    async getCurrentUser() {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session?.user || null;
    },
    
    async getUserProfile() {
        const user = await this.getCurrentUser();
        if (!user) return null;
        
        return await Database.getProfile(user.id);
    },
    
    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        localStorage.clear();
        sessionStorage.clear();
        Realtime.unsubscribeAll();
    },
    
    async refreshSession() {
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        return session;
    }
};

// Export to window
window.supabaseClient = supabase;
window.Database = Database;
window.Realtime = Realtime;
window.Session = Session;
window.callEdgeFunction = callEdgeFunction;
window.EDGE_FUNCTIONS = EDGE_FUNCTIONS;

// Auto-refresh token
setInterval(async () => {
    try {
        await Session.refreshSession();
    } catch (error) {
        console.warn('Session refresh failed:', error);
    }
}, 15 * 60 * 1000); // Every 15 minutes
