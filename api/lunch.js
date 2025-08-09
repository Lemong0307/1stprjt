// 이 파일은 Node.js 환경에서 실행됩니다.
// Vercel이 이 파일을 자동으로 서버처럼 동작하게 만들어줍니다.

// 날짜를 YYYYMMDD 형식으로 변환하는 헬퍼 함수
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

export default async function handler(request, response) {
    const { API_KEY, ATPT_OFCDC_SC_CODE, SD_SCHUL_CODE } = process.env;

    // 더 확실하게 다음 주를 찾는 날짜 계산 로직
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=일, 1=월, ..., 6=토
    let monday = new Date(today);

    if (dayOfWeek === 6) { // 토요일이면 이틀 뒤 월요일
        monday.setDate(today.getDate() + 2);
    } else if (dayOfWeek === 0) { // 일요일이면 하루 뒤 월요일
        monday.setDate(today.getDate() + 1);
    } else { // 평일이면 현재 속한 주의 월요일
        monday.setDate(today.getDate() - (dayOfWeek - 1));
    }

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const startDate = formatDate(monday);
    const endDate = formatDate(friday);
    
    const URL = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=5&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}&KEY=${API_KEY}`;

    try {
        const apiResponse = await fetch(URL);
        const data = await apiResponse.json();

        if (data.mealServiceDietInfo && data.mealServiceDietInfo[1].row) {
            const weekMenuData = data.mealServiceDietInfo[1].row;
            
            const processedMenu = weekMenuData.map(item => {
                // [수정된 부분!] DDISH_INFO가 있을 때만 split 하고, 없으면 빈 배열([])을 사용하도록 수정
                const menuList = (item.DDISH_INFO || "").split('<br/>').map(menu => menu.replace(/\s*\([\d\.]+\)/g, '').trim());
                
                return {
                    date: item.MLSV_YMD,
                    calories: item.CAL_INFO,
                    menu: menuList.filter(m => m) // 혹시 모를 빈 항목 제거
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
