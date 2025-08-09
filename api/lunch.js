// 이 파일은 Node.js 환경에서 실행됩니다.
// Vercel이 이 파일을 자동으로 서버처럼 동작하게 만들어줍니다.
// 최종 검토 버전 (중식 필터링 적용)

// 날짜를 YYYYMMDD 형식으로 변환하는 헬퍼 함수
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

export default async function handler(request, response) {
    const { API_KEY, ATPT_OFCDC_SC_CODE, SD_SCHUL_CODE } = process.env;

    // 시차(Timezone) 문제를 해결하고, 요일별 로직을 명확히 한 최종 로직
    const kstTime = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
    const dayOfWeek = kstTime.getDay();
    let monday = new Date(kstTime);

    if (dayOfWeek >= 1 && dayOfWeek <= 5) { monday.setDate(kstTime.getDate() - (dayOfWeek - 1)); } 
    else if (dayOfWeek === 6) { monday.setDate(kstTime.getDate() + 2); } 
    else { monday.setDate(kstTime.getDate() + 1); }

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const startDate = formatDate(monday);
    const endDate = formatDate(friday);
    
    const URL = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=15&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}&KEY=${API_KEY}`;

    try {
        const apiResponse = await fetch(URL);
        const data = await apiResponse.json();

        if (data.mealServiceDietInfo && data.mealServiceDietInfo[1].row) {
            const weekMenuData = data.mealServiceDietInfo[1].row;
            
            // --- [최종 수정!] 받아온 모든 식단 정보 중, '중식'만 골라낸다. ---
            const lunchDataOnly = weekMenuData.filter(item => item.MMEAL_SC_NM === '중식');

            const processedMenu = lunchDataOnly.map(item => {
                const menuList = (item.DDISH_INFO || "").split('<br/>').map(menu => menu.replace(/\s*\([\d\.]+\)/g, '').trim());
                return {
                    date: item.MLSV_YMD,
                    calories: item.CAL_INFO,
                    menu: menuList.filter(m => m)
                };
            });
            response.status(200).json({ weekMenu: processedMenu });
        } else if (data.RESULT && data.RESULT.CODE === 'INFO-200') {
            response.status(200).json({ weekMenu: [] });
        } else {
            throw new Error(data.RESULT ? data.RESULT.MESSAGE : 'NEIS API Error');
        }
    } catch (error) {
        console.error("API 요청 에러:", error);
        response.status(500).json({ error: '서버에서 급식 정보를 가져오는 데 실패했습니다.' });
    }
}
