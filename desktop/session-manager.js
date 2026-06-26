const os = require('os');
const cloudApi = require('./cloud-api');
const authStore = require('./auth-store');
const deviceStore = require('./device-store');
const machineId = require('./machine-id');
const cloudAgent = require('./cloud-agent');

async function connectDeviceWithToken(authToken) {
    const config = deviceStore.getCloudConfig();
    const device = await cloudApi.registerDevice(config.serverUrl, authToken, {
        name: config.deviceName || os.hostname(),
        machineId: machineId.getMachineId(),
        platform: process.platform,
        hostname: os.hostname()
    });

    deviceStore.saveCloudCredentials({
        deviceToken: device.token,
        deviceId: device.id,
        deviceName: device.name
    });

    await cloudAgent.startCloudAgent();
    return device;
}

async function login({ email, password, deviceName, name }) {
    const config = deviceStore.getCloudConfig();

    if (deviceName) {
        deviceStore.setDeviceName(deviceName);
    }

    const result = await cloudApi.login(config.serverUrl, { email, password });
    authStore.saveSession({ token: result.token, user: result.user });

    const device = await connectDeviceWithToken(result.token);

    return {
        user: result.user,
        device,
        cloud: cloudAgent.getCloudStatus()
    };
}

async function register({ email, password, name, deviceName }) {
    const config = deviceStore.getCloudConfig();

    if (deviceName) {
        deviceStore.setDeviceName(deviceName);
    }

    const result = await cloudApi.register(config.serverUrl, { email, password, name });
    authStore.saveSession({ token: result.token, user: result.user });

    const device = await connectDeviceWithToken(result.token);

    return {
        user: result.user,
        device,
        cloud: cloudAgent.getCloudStatus()
    };
}

async function restoreSession() {
    const session = authStore.getSession();
    if (!session?.token) {
        return null;
    }

    try {
        const config = deviceStore.getCloudConfig();
        const user = await cloudApi.me(config.serverUrl, session.token);
        authStore.saveSession({ token: session.token, user });
        const device = await connectDeviceWithToken(session.token);

        return {
            user,
            device,
            cloud: cloudAgent.getCloudStatus()
        };
    } catch (error) {
        await logout();
        return null;
    }
}

async function logout() {
    cloudAgent.stopCloudAgent();
    authStore.clearSession();
    deviceStore.clearDeviceCredentials();
}

async function renameDevice(name) {
    const session = authStore.getSession();
    const config = deviceStore.getCloudConfig();

    if (!session?.token || !config.deviceId) {
        throw new Error('No hay sesión activa.');
    }

    const device = await cloudApi.updateDeviceName(
        config.serverUrl,
        session.token,
        config.deviceId,
        name
    );

    deviceStore.setDeviceName(device.name);
    return device;
}

function getAuthState() {
    const session = authStore.getSession();
    const cloud = cloudAgent.getCloudStatus();

    return {
        loggedIn: Boolean(session?.token),
        user: session?.user || null,
        cloud
    };
}

module.exports = {
    login,
    register,
    restoreSession,
    logout,
    renameDevice,
    getAuthState
};
