// 이 파일은 Node.js 환경에서 실행됩니다.
// Vercel이 이 파일을 자동으로 서버처럼 동작하게 만들어줍니다.
// (급식 메뉴 디버깅 버전)

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

export default async function handler(request, response) {
    const { API_KEY, ATPT_OFCDC_SC_CODE, SD_SCHUL_CODE } = process.env;

    if (!API_KEY || !ATPT_OFCDC_SC_CODE || !SD_SCHUL_CODE) {
        console.error("환경변수(API_KEY, ATPT_OFCDC_SC_CODE, SD_SCHUL_CODE) 중 하나가 누락되었습니다.");
        return response.status(500).json({ error: '서버 환경변수가 설정되지 않았습니다.' });
    }

    const kstTime = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
    const dayOfWeek = kstTime.getDay();
    let monday = new Date(kstTime);

    if (dayOfWeek >= 1 && dayOfWeek <= 5) { 
        monday.setDate(kstTime.getDate() - (dayOfWeek - 1)); 
    } else if (dayOfWeek === 6) { 
        monday.setDate(kstTime.getDate() + 2); 
    } else { 
        monday.setDate(kstTime.getDate() + 1); 
    }

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const startDate = formatDate(monday);
    const endDate = formatDate(friday);
    
    const URL = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=15&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}&KEY=${API_KEY}`;

    try {
        const apiResponse = await fetch(URL);
        const data = await apiResponse.json();

        // 📌 디버깅: API 응답 전체 출력
        console.log("=== NEIS API 응답 원본 ===");
        console.log(JSON.stringify(data, null, 2));

        const dailyMenus = {};

        if (data.mealServiceDietInfo && data.mealServiceDietInfo[1].row) {
            const weekMenuData = data.mealServiceDietInfo[1].row;
            
            weekMenuData.forEach(item => {
                const date = item.MLSV_YMD;
                if (!dailyMenus[date]) {
                    dailyMenus[date] = {};
                }

                const menuInfo = {
                    calories: item.CAL_INFO,
                    menu: (item.DDISH_INFO || "")
                        .split(/<br\s*\/?>|\n/g)
                        .map(menu => menu.trim())
                        .filter(m => m)
                };

                if (item.MMEAL_SC_NM === '중식') {
                    dailyMenus[date].lunch = menuInfo;
                } else if (item.MMEAL_SC_NM === '석식') {
                    dailyMenus[date].dinner = menuInfo;
                }
            });
        } else {
            console.warn("급식 데이터가 없습니다. API 응답:", data);
        }
        
        response.status(200).json({ dailyMenus });

    } catch (error) {
        console.error("API 요청 에러:", error);
        response.status(500).json({ error: '서버에서 급식 정보를 가져오는 데 실패했습니다.' });
    }
}