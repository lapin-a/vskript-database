const fs = require('fs');
const path = require('path');

const addonsDir = path.join(__dirname, 'addons');
if (!fs.existsSync(addonsDir)) {
    fs.mkdirSync(addonsDir, { recursive: true });
}

/**
 * 🗺️ [독립성 보장] 데이터의 원형을 그대로 슬러그로 사용
 */
function getAddonSlug(item) {
    if (!item) return 'coreskript';

    // 1. addon 필드에서 이름 추출 (가공 최소화)
    let slug = 'misc';
    if (item.addon_name) {
        slug = item.addon_name;
    } else if (item.addon && typeof item.addon === 'object') {
        slug = item.addon.slug || item.addon.name || 'misc';
    } else if (item.addon) {
        slug = String(item.addon);
    }

    // 파일명으로 사용 가능하도록 특수문자만 정리 (의미 변형 방지)
    return String(slug).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
}

/**
 * 🚀 [Main Engine] 애드온별 1:1 독립 파일 사출
 */
function runConverter() {
    const sourceFilePath = path.join(__dirname, 'skripthub.net.json');
    if (!fs.existsSync(sourceFilePath)) return;

    const rawDataString = fs.readFileSync(sourceFilePath, 'utf-8');
    const allSyntaxes = JSON.parse(rawDataString).results || JSON.parse(rawDataString);

    const addonBuckets = {};

    // 1. 독립 바구니 생성
    allSyntaxes.forEach((item) => {
        const slug = getAddonSlug(item);
        if (!addonBuckets[slug]) addonBuckets[slug] = [];
        addonBuckets[slug].push(item);
    });

    // 2. 각 애드온별 파일 개별 생성
    Object.keys(addonBuckets).forEach((slug) => {
        const targetFilePath = path.join(addonsDir, `${slug}.json`);
        const liveItems = addonBuckets[slug];

        // 한국어 번역 자산 유지를 위한 기존 데이터 확인
        let localBackup = null;
        if (fs.existsSync(targetFilePath)) {
            try { localBackup = JSON.parse(fs.readFileSync(targetFilePath, 'utf-8')); } catch (e) {}
        }

        const database = {};
        liveItems.forEach((item) => {
            const safeKeyName = (item.name || `syntax_${item.id}`).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            const serverUpdatedAt = item.updated_at || item.created_at || "2026-01-01T00:00:00Z";
            
            // 기존 데이터가 있다면 한국어 정보 승계
            database[safeKeyName] = {
                ...item,
                updated_at: serverUpdatedAt,
                guide: {
                    en: [item.description || ""],
                    ko: localBackup?.[safeKeyName]?.guide?.ko || ["[번역 대기 중]"]
                }
            };
        });

        fs.writeFileSync(targetFilePath, JSON.stringify(database, null, 2), 'utf-8');
    });
}

runConverter();