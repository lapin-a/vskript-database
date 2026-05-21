const fs = require('fs');
const path = require('path');

// ==========================================
// [설정 구역] 수집한 원천 파일과 사출할 타겟 경로
// ==========================================
const RAW_DATA_PATH = path.join(__dirname, 'raw_addon_data.json'); // 글로벌 사이트에서 긁어온 원본 파일
const TARGET_ADDON_NAME = 'tuske'; // 사출할 애드온 파일명 (소문자 권장)
const OUTPUT_PATH = path.join(__dirname, `${TARGET_ADDON_NAME}.json`);

/**
 * 🌟 [유저 기획 원천 반영]
 * 수천 개의 글로벌 로우 데이터를 우리 인텔리센스 및 버전 호환성 매트릭스 규격으로 자동 세척
 */
function transformDatabase() {
    if (!fs.existsSync(RAW_DATA_PATH)) {
        console.error(`❌ [에러] 원천 데이터 파일이 존재하지 않습니다: ${RAW_DATA_PATH}`);
        console.info(`💡 팁: 글로벌 아카이브에서 덤프한 로우 데이터를 해당 경로에 먼저 배치해 주세요.`);
        return;
    }

    try {
        const rawContent = fs.readFileSync(RAW_DATA_PATH, 'utf-8');
        const rawJson = JSON.parse(rawContent);
        
        // 사출될 무결점 초경량 데이터베이스 객체
        const polishedDatabase = {};

        // 글로벌 소스들의 다양한 배열/객체 형태를 안전하게 순회하기 위한 타겟 풀 확보
        const rawSyntaxes = Array.isArray(rawJson) ? rawJson : (rawJson.data || rawJson.syntaxes || []);

        rawSyntaxes.forEach((item, index) => {
            // 필수 필드가 누락된 노이즈 데이터는 방어막 가동하여 스킵
            if (!item || (!item.name && !item.id)) return;

            const name = (item.name || item.id).trim();
            const addon = item.addon || item.plugin || 'UnknownAddon';
            const type = (item.type || item.node_type || 'effect').toLowerCase();
            
            // patterns 배열 안전성 정제 (생략 부호, 정규식 노이즈 1차 마사지)
            let patterns = [];
            if (Array.isArray(item.patterns)) {
                patterns = item.patterns.map(p => String(p).trim());
            } else if (item.pattern) {
                patterns = [String(item.pattern).trim()];
            }

            if (patterns.length === 0) return; // 타이핑 양식이 없으면 자동완성이 불가능하므로 제외

            // 🌟 [중복 방지 유니크 키 매핑] -> "애드온명:구문대표명" 규격 수립
            const uniqueKey = `${addon}:${name.replace(/\s+/g, '_')}`;

            // 🌟 [버전 크로스 체크 매트릭스 보정]
            // Skript 코어에 언제 흡수(내장)되었는지 기록하는 배열 필드 확보
            let addedVersions = ["1.0"];
            if (item.added) {
                addedVersions = Array.isArray(item.added) ? item.added : [String(item.added)];
            } else if (item.absorbed_in_core_version) {
                addedVersions = [String(item.absorbed_in_core_version)];
            }

            // 도움말 가이드라인 래핑 및 포맷 조율
            let descriptionEn = "";
            if (item.description) {
                descriptionEn = Array.isArray(item.description) 
                    ? item.description.map(d => String(d)) 
                    : [String(item.description)];
            } else {
                descriptionEn = [`No default description provided for ${name}.`];
            }

            // 한국어 설명 필드 폴백 라인 생성 (나중에 번역기를 태우거나 수집할 때 대응)
            const descriptionKo = item.description_ko || `[${addon}] 해당 구문의 한국어 번역 가이드가 등록되지 않았습니다.`;

            // 우리 엔진 규격 규격에 맞게 데이터 최종 조립 및 패킹
            polishedDatabase[uniqueKey] = {
                "name": name,
                "added": addedVersions,
                "addon": addon,
                "type": type,
                "patterns": patterns,
                "description": {
                    "en": descriptionEn,
                    "ko": descriptionKo
                }
            };
        });

        // 결과물을 물리 파일로 일괄 사출 (JSON 가독성 포맷 적용)
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(polishedDatabase, null, 2), 'utf-8');
        
        const resultCount = Object.keys(polishedDatabase).length;
        console.log(`\n🟢 [변환 완료] 데이터베이스 대성공!`);
        console.log(`📊 총 ${resultCount}개의 구문이 우리 플랫폼 규격으로 무결점 세척되었습니다.`);
        console.log(`💾 사출된 파일: ${OUTPUT_PATH}\n`);

    } catch (error) {
        console.error(`🚨 [치명적 실패] JSON 파싱 및 데이터 변환 중 에러 발생:`, error);
    }
}

// 스크립트 실행
transformDatabase();