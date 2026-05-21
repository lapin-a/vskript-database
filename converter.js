const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ==========================================
// [설정 구역] 경로 인프라 정의
// ==========================================
const MASTER_MAP_PATH = path.join(__dirname, 'skripthub.net.json'); 
const ADDONS_DIR = path.join(__dirname, 'addons');

/**
 * 🌐 원격 서버망에서 실시간으로 데이터를 다운로드하는 쉘 브릿지
 */
function requestUrl(url) {
    try {
        let rawData = "";
        if (process.platform === 'win32') {
            rawData = execSync(`powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-RestMethod -Uri '${url}'"`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 50 });
        } else {
            rawData = execSync(`curl -s -L "${url}"`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 50 });
        }
        return rawData.trim();
    } catch (err) {
        return null;
    }
}

/**
 * 🛠️ 원천 데이터를 VSkript 규격 매트릭스로 정밀 세척
 */
function cleanAndFormat(rawJson, defaultAddonName) {
    const polishedDatabase = {};
    const rawSyntaxes = Array.isArray(rawJson) ? rawJson : (rawJson.data || rawJson.syntaxes || []);

    rawSyntaxes.forEach((item) => {
        if (!item || (!item.name && !item.id)) return;

        const name = (item.name || item.id).trim();
        const addon = item.addon || item.plugin || defaultAddonName;
        const type = (item.type || item.node_type || 'effect').toLowerCase();
        
        let patterns = [];
        if (Array.isArray(item.patterns)) {
            patterns = item.patterns.map(p => String(p).trim());
        } else if (item.pattern) {
            patterns = [String(item.pattern).trim()];
        }

        if (patterns.length === 0) return;

        const uniqueKey = `${addon}:${name.replace(/\s+/g, '_')}`;
        let addedVersions = ["1.0"];
        if (item.added) {
            addedVersions = Array.isArray(item.added) ? item.added : [String(item.added)];
        }

        let descriptionEn = item.description ? (Array.isArray(item.description) ? item.description.map(d => String(d)) : [String(item.description)]) : [`No description.`];

        polishedDatabase[uniqueKey] = {
            "name": name,
            "added": addedVersions,
            "addon": addon,
            "type": type,
            "patterns": patterns,
            "description": {
                "en": descriptionEn,
                "ko": `[${addon}] 한국어 가이드팩 미정치 상태`
            }
        };
    });

    return polishedDatabase;
}

/**
 * 🔒 변경 사항이 발생한 자원만 깃허브 클라우드로 엄선 사출
 */
function pushChangesToGitHub(updatedCount) {
    if (updatedCount === 0) {
        console.log(`\n😎 [안내] 깃허브 원격 서버와 로컬 데이터가 100% 일치합니다. 푸시를 생략합니다.`);
        return;
    }

    console.log(`\n📦 [4단계] 총 ${updatedCount}개의 수정된 파일 발견! 깃허브(lapin-a/vskript-database) 푸시 시작...`);
    try {
        if (!fs.existsSync(path.join(__dirname, '.git'))) {
            execSync(`git init`, { stdio: 'ignore' });
            execSync(`git remote add origin https://github.com/lapin-a/vskript-database.git`, { stdio: 'ignore' });
            execSync(`git branch -M main`, { stdio: 'ignore' });
        }

        execSync(`git add .`);
        execSync(`git commit -m "data: update ${updatedCount} changed/new addons through smart incremental database pipeline"`, { stdio: 'ignore' });
        execSync(`git push origin main`);
        console.log(`🟢 [마스터 동기화 완공] 변경된 항목만 클라우드망에 완벽하게 업데이트되었습니다!`);
    } catch (gitErr) {
        console.error(`❌ Git 일괄 배포 중 에러 발생:`, gitErr.message);
    }
}

// ==========================================
// 마스터 파이프라인 스케줄러 실행
// ==========================================
(function main() {
    console.log(`🏁 [VSkript 스마트 증분 업데이트 데이터베이스 엔진 기동]`);

    if (!fs.existsSync(ADDONS_DIR)) {
        fs.mkdirSync(ADDONS_DIR, { recursive: true });
    }

    // 1️⃣ [마스터 지도 자동 갱신] 주기적 업데이트를 위해 인터넷에서 skripthub 마스터 목록 가로채기
    console.log(`📡 [1단계] 최신 마스터 지도(skripthub.net.json) 원격지에서 로드 중...`);
    const remoteMasterData = requestUrl('https://skripthub.net/api/v1/addon/');
    
    if (remoteMasterData) {
        fs.writeFileSync(MASTER_MAP_PATH, JSON.stringify(JSON.parse(remoteMasterData), null, 2), 'utf-8');
        console.log(`💾 마스터 지도 최신 사양으로 로컬 리프레시 완착.`);
    } else if (!fs.existsSync(MASTER_MAP_PATH)) {
        console.error(`❌ 원격 통신 실패 및 로컬에 기존 지도 파일이 없습니다. 공정을 중단합니다.`);
        return;
    } else {
        console.log(`⚠️ 원격 지도 획득 실패 -> 로컬에 보존되어 있던 기존 마스터 지도로 우회 스캔을 가동합니다.`);
    }

    const addonList = JSON.parse(fs.readFileSync(MASTER_MAP_PATH, 'utf-8'));
    console.log(`📊 현재 포착된 글로벌 애드온 총 개수: ${addonList.length}개\n`);

    let updatedCount = 0;

    // 2️⃣ [스마트 딥 대조 루프] 전수조사를 돌되, 과거 파일과 현재 상태를 대조하여 갱신된 것만 수정
    addonList.forEach((addon, index) => {
        const simulatedId = index + 1;
        const cleanFileName = addon.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetFilePath = path.join(ADDONS_DIR, `${cleanFileName}.json`);

        console.log(`[${index + 1}/${addonList.length}] 🔍 [${addon.name}] 상태 정밀 추적 중...`);

        // 인터넷에서 해당 애드온의 진짜 원천 syntax 데이터 가져오기
        const rawDataStr = requestUrl(`https://skripthub.net/api/v1/syntax/?addon=${simulatedId}`);
        if (!rawDataStr) return;

        // 우리 규격으로 일단 메모리 상에서 세척 수행
        const freshPolishedData = cleanAndFormat(JSON.parse(rawDataStr), addon.name);
        const hasFreshData = Object.keys(freshPolishedData).length > 0;

        // 🌟 [유저 기획의 핵심: 과거 파일과 현재 파일 비교 분기점]
        if (fs.existsSync(targetFilePath)) {
            if (!hasFreshData) return; // 원격 데이터가 유실되었거나 없으면 기존 로컬 영구 파일 보존

            const existingDataStr = fs.readFileSync(targetFilePath, 'utf-8');
            const freshDataStr = JSON.stringify(freshPolishedData, null, 2);

            // 문자열 대조를 통해 완벽하게 내용물이 일치하는지 체크 (용량/수정 검증)
            if (existingDataStr === freshDataStr) {
                console.log(`   └─ ✅ 변동 사항 없음 [Skip]`);
                return; // 0ms 스킵 가동! 불필요한 디스크 쓰기 및 업데이트를 싹 차단합니다.
            }
        }

        // 과거 파일과 내용이 다르거나, 아예 새로 태어난 파일일 경우에만 업데이트 처리 수행!
        if (hasFreshData) {
            fs.writeFileSync(targetFilePath, JSON.stringify(freshPolishedData, null, 2), 'utf-8');
            updatedCount++;
            console.log(`   └─ 🔥 [수정/신규] 변경 사항 감지되어 데이터 갱신 완료! (${cleanFileName}.json)`);
        } else {
            // 원천지에 문법이 아예 없는데 템플릿도 없는 경우만 방어막 작동
            if (!fs.existsSync(targetFilePath)) {
                fs.writeFileSync(targetFilePath, JSON.stringify({}, null, 2), 'utf-8');
            }
        }
    });

    console.log(`\n📊 [검사 종료] 스캔 완료. 최종 수정 및 추가된 애드온 파일 개수: ${updatedCount}개`);

    // 3️⃣ 변경 사항이 감지된 항목이 1개라도 있을 때만 깃허브 실시간 배포 집행
    pushChangesToGitHub(updatedCount);
})();