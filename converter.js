const fs = require('fs');
const path = require('path');

// 출력 디렉토리(addons/) 안전하게 생성
const addonsDir = path.join(__dirname, 'addons');
if (!fs.existsSync(addonsDir)) {
    fs.mkdirSync(addonsDir, { recursive: true });
    console.log(`📁 [System] 안전 지대 생성 완료: ${addonsDir}`);
}

/**
 * 💡 [핵심 브레인] 가이드 텍스트를 분석하여 비어있는 patterns 레이어를 복구하는 인공지능형 파서
 */
function inferPatternsAndName(syntaxKey, item) {
    let guessedName = item.name || syntaxKey;
    let inferredPatterns = [];

    // 가이드 문서 알맹이가 존재할 경우 수색 시작
    if (item.guide && item.guide.en && item.guide.en.length > 0) {
        const firstLine = item.guide.en[0];
        
        // 시나리오 A: 가이드의 첫 줄이 일반 설명글인 경우 제목으로 변환
        if (firstLine.length < 60 && !firstLine.includes('=')) {
            guessedName = firstLine.replace(/[^a-zA-Z0-9_\s]/g, '').trim().replace(/\s+/g, '_').toLowerCase();
        }

        // 시나리오 B: 가이드 내부에 'Patterns:', 'Entries:' 혹은 따옴표 구문 탐색하여 문법 패턴 추출
        item.guide.en.forEach(line => {
            if (line.startsWith('- `') && line.includes('` =')) {
                // 구조적 엔트리 구문을 패턴 후보군으로 자동 변환 (ex: - `default_mining_speed` = ...)
                const match = line.match(/`([^`]+)`/);
                if (match) inferredPatterns.push(`${match[1]} %object%`);
            } else if (line.includes('`') && line.length < 80 && (line.includes('%') || line.includes('apply') || line.includes('get'))) {
                // 따옴표 기호 안의 실제 스크립트 형태의 문법 규격 검출
                const matches = line.match(/`([^`]+)`/g);
                if (matches) {
                    matches.forEach(m => inferredPatterns.push(m.replace(/`/g, '').trim()));
                }
            }
        });
    }

    // 만약 어떠한 패턴도 유출해내지 못했다면, 인텔리센스 가동을 위한 기본 플레이스홀더 패턴 강제 부여
    if (inferredPatterns.length === 0) {
        const cleanName = guessedName.replace(/_/g, ' ');
        if (item.type === 'effect') inferredPatterns.push(`[skbee] ${cleanName} %objects%`);
        else if (item.type === 'condition') inferredPatterns.push(`%object% is [skbee] ${cleanName}`);
        else if (item.type === 'event') inferredPatterns.push(`[on] skbee ${cleanName}`);
        else inferredPatterns.push(`[skbee] ${cleanName} of %object%`);
    }

    // 중복 제거 가동
    inferredPatterns = [...new Set(inferredPatterns)];

    return { 
        finalName: guessedName, 
        patterns: inferredPatterns 
    };
}

/**
 * 🛠️ 2단계: 날것의 SkBee 덤프 데이터를 VSkript 규격 고도화 사양으로 세척
 */
function cleanAndFormatSkBee(rawDump) {
    const polishedDatabase = {};

    Object.keys(rawDump).forEach((syntaxKey) => {
        const item = rawDump[syntaxKey];
        if (!item) return;

        // 1. 비어있는 패턴과 유실된 이름을 가이드 분석을 통해 역추적 복구
        const { finalName, patterns } = inferPatternsAndName(syntaxKey, item);

        // 2. 가이드 내 특수 마크다운 태그 세척 및 레이아웃 유지
        let desc = [];
        if (item.guide && item.guide.en) {
            desc = item.guide.en.map(d => d.trim()).filter(d => d.length > 0);
        }

        // 3. VSkript 표준 단어 매트릭스 형태로 최종 변환 박제
        polishedDatabase[finalName] = {
            id: item.id || parseInt(syntaxKey.replace('syntax_', '')) || null,
            type: (item.type || 'expression').toLowerCase(),
            patterns: patterns,
            added: item.added || "2.0",
            guide: {
                en: desc.length > 0 ? desc : [`[SkBee] No official English guide provided.`],
                ko: desc.length > 0 
                    ? desc.map(line => `[번역 대기] ${line}`) // 한글 사전 빌드업을 위한 번역 플레이스홀더 자동 이식
                    : [`[SkBee] 한국어 가이드팩 준비 중`]
            }
        };
    });

    return polishedDatabase;
}

/**
 * 🚀 [Main Controller] SkBee 특화 파이프라인 구동 엔진
 */
function runSkBeeConversion() {
    // 💡 유저님이 제공해주신 덤프 파일이 위치할 경로 지정
    const sourceFilePath = path.join(__dirname, 'skripthub.net.json');

    if (!fs.existsSync(sourceFilePath)) {
        console.error(`❌ [Error] 원천 파일(skripthub.net.json)이 누락되었습니다.`);
        return;
    }

    console.log(`⏳ [Pipeline] 제공해주신 SkBee 데이터 로딩 중...`);
    const rawDataString = fs.readFileSync(sourceFilePath, 'utf-8');
    
    let rawDump;
    try {
        rawDump = JSON.parse(rawDataString);
    } catch (e) {
        console.error(`❌ [Error] JSON 문법 파싱에 실패했습니다. 포맷을 확인하세요.`);
        return;
    }

    console.log(`⚡ [Pipeline] SkBee 자산 정밀 가공 및 패턴 역추적 복구 공정 가동...`);
    
    // 규격 세척 및 패턴 생성 완료된 알맹이 쟁취
    const cleanData = cleanAndFormatSkBee(rawDump);
    const totalSyntaxes = Object.keys(cleanData).length;

    // 최종 물리 파일 저장 사출
    const outputFilePath = path.join(addonsDir, 'skbee.json');
    fs.writeFileSync(outputFilePath, JSON.stringify(cleanData, null, 2), 'utf-8');

    console.log(`\n✅ [추출 대성공] -> addons/skbee.json 파일 대완공!`);
    console.log(`🏁 [System] 총 ${totalSyntaxes}개의 문법 패턴과 가이드 데이터가 영구 박제되었습니다.`);
}

// 파이프라인 엔진 즉시 기동
runSkBeeConversion();