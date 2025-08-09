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
    // 1. 비밀 정보들을 안전하게 가져오기 (Vercel에 설정)
    const { API_KEY, ATPT_OFCDC_SC_CODE, SD_SCHUL_CODE } = process.env;

    // 2. 이번 주 월요일과 금요일 날짜 계산하기
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0(일) ~ 6(토)
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 일요일이면 6일 빼고, 아니면 (1 - 요일) 만큼 빼기

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const startDate = formatDate(monday); // YYYYMMDD
    const endDate = formatDate(friday);   // YYYYMMDD

    // 3. 나이스 API에 보낼 요청 주소 (기간으로 조회)
    const URL = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=5&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}&KEY=${API_KEY}`;

    try {
        const apiResponse = await fetch(URL);
        const data = await apiResponse.json();

        // 4. 나이스로부터 받은 데이터 처리하기
        if (data.mealServiceDietInfo && data.mealServiceDietInfo[1].row) {
            const weekMenuData = data.mealServiceDietInfo[1].row;
            
            // 5. 프론트엔드로 보내기 좋게 데이터 가공하기
            const processedMenu = weekMenuData.map(item => {
                return {
                    date: item.MLSV_YMD, // "20250811"
                    calories: item.CAL_INFO, // "588.3 Kcal"
                    menu: item.DDISH_INFO.split('<br/>').map(menu => menu.replace(/\s*\([\d\.]+\)/g, '').trim())
                };
            });

            // 6. 가공된 데이터를 사용자에게 보내주기
            response.status(200).json({ weekMenu: processedMenu });

        } else if (data.RESULT && data.RESULT.CODE === 'INFO-200') {
            // 이번 주 급식 정보가 아예 없는 경우
            response.status(200).json({ weekMenu: [] });
        } else {
            // API 키가 잘못되는 등 나이스에서 에러를 보낸 경우
            throw new Error(data.RESULT ? data.RESULT.MESSAGE : 'NEIS API Error');
        }
    } catch (error) {
        console.error("API 요청 에러:", error);
        response.status(500).json({ error: '서버에서 급식 정보를 가져오는 데 실패했습니다.' });
    }
}
