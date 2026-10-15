/**
 * PixelGameKit - ストレージユーティリティ
 */

const Storage = {
    // LocalStorageに保存
    save(key, data) {
        try {
            const json = JSON.stringify(data);
            localStorage.setItem('pgk_' + key, json);
            return true;
        } catch (e) {
            console.error('Storage save failed:', e);
            return false;
        }
    },

    // LocalStorageから読み込み
    load(key) {
        try {
            const json = localStorage.getItem('pgk_' + key);
            if (json) {
                return JSON.parse(json);
            }
            return null;
        } catch (e) {
            console.error('Storage load failed:', e);
            return null;
        }
    },

    // 削除
    remove(key) {
        try {
            localStorage.removeItem('pgk_' + key);
            return true;
        } catch (e) {
            return false;
        }
    },

    // プロジェクトリスト管理
    // 不正エントリ（name欠落）が混入していたら自動除去して書き戻す（自己修復）
    getProjectList() {
        const raw = this.load('projectList') || [];
        const cleaned = raw.filter(p => p && typeof p.name === 'string' && p.name.length > 0);
        if (cleaned.length !== raw.length) {
            this.save('projectList', cleaned);
            this.remove('project_undefined');
        }
        return cleaned;
    },

    saveProject(name, data) {
        // 引数欠落・空名の呼び出しで projectList に {name: undefined} の
        // ゴミエントリが混入する過去バグ対策（開くモーダルを fatal にする原因になった）
        if (typeof name !== 'string' || name.length === 0) {
            console.error('Storage.saveProject: invalid name', name);
            return false;
        }
        const list = this.getProjectList();
        const index = list.findIndex(p => p.name === name);
        const entry = {
            name: name,
            updatedAt: Date.now()
        };

        if (index >= 0) {
            list[index] = entry;
        } else {
            list.push(entry);
        }

        this.save('projectList', list);
        this.save('project_' + name, data);
        return true;
    },

    loadProject(name) {
        return this.load('project_' + name);
    },

    deleteProject(name) {
        const list = this.getProjectList();
        const index = list.findIndex(p => p.name === name);
        if (index >= 0) {
            list.splice(index, 1);
            this.save('projectList', list);
            this.remove('project_' + name);
        }
    },

    // プロジェクトの存在確認
    projectExists(name) {
        const list = this.getProjectList();
        return list.some(p => p.name === name);
    },

    // プロジェクトを複製
    duplicateProject(srcName, newName) {
        const data = this.loadProject(srcName);
        if (!data) return false;

        // メタデータ更新
        data.meta.createdAt = Date.now(); // 複製時は作成日時を更新

        this.saveProject(newName, data);
        return true;
    }
};
