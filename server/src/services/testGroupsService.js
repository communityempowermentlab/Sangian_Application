const fs = require('fs');
const path = require('path');
const { GAMES_REGISTRY } = require('./testConfigService');

const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'test-groups.json');
const VALID_KEYS = new Set(GAMES_REGISTRY.map(g => g.key));

const readGroups = () => {
    if (!fs.existsSync(CONFIG_FILE)) return [];
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
};

const writeGroups = (groups) => {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(groups, null, 2) + '\n');
};

const cleanKeys = (gameKeys) => [...new Set((gameKeys || []).filter(k => VALID_KEYS.has(k)))];

const getList = () => readGroups();

const createGroup = ({ name, gameKeys }) => {
    if (!name || !name.trim()) throw new Error('Group name is required.');
    const keys = cleanKeys(gameKeys);
    if (keys.length === 0) throw new Error('Select at least one test.');

    const groups = readGroups();
    const group = {
        id: 'tg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name.trim(),
        gameKeys: keys,
        createdAt: new Date().toISOString(),
    };
    groups.push(group);
    writeGroups(groups);
    return group;
};

const updateGroup = (id, { name, gameKeys }) => {
    const groups = readGroups();
    const idx = groups.findIndex(g => g.id === id);
    if (idx === -1) throw new Error('Test group not found.');

    const nextName = name !== undefined ? name.trim() : groups[idx].name;
    if (!nextName) throw new Error('Group name is required.');
    const nextKeys = gameKeys !== undefined ? cleanKeys(gameKeys) : groups[idx].gameKeys;
    if (nextKeys.length === 0) throw new Error('Select at least one test.');

    groups[idx] = { ...groups[idx], name: nextName, gameKeys: nextKeys };
    writeGroups(groups);
    return groups[idx];
};

const deleteGroup = (id) => {
    const groups = readGroups();
    const next = groups.filter(g => g.id !== id);
    if (next.length === groups.length) throw new Error('Test group not found.');
    writeGroups(next);
};

module.exports = { getList, createGroup, updateGroup, deleteGroup };
