// 이 파일은 Node.js 환경에서 실행됩니다.
// Vercel이 이 파일을 자동으로 서버처럼 동작하게 만들어줍니다.

export default async function handler(request, response) {
    // 1. 비밀 정보들을 안전하게 가져오기 (Vercel에 설정)
    const { API_KEY, ATPT_OFCDC_SC_CODE, SD_SCHUL_CODE } = process.env;

    // 2. 오늘 날짜를 YYYYMMDD 형식으로 만들기
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const yyyymmdd = `${year}${month}${day}`;

    // 3. 나이스 API에 보낼 요청 주소
    const URL = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=1&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_YMD=${yyyymmdd}&KEY=${API_KEY}`;

    try {
        const apiResponse = await fetch(URL);
        const data = await apiResponse.json();

        // 4. 나이스로부터 받은 데이터 처리하기
        if (data.mealServiceDietInfo && data.mealServiceDietInfo[1].row) {
            const menuInfo = data.mealServiceDietInfo[1].row[0];
            const menuList = menuInfo.DDISH_INFO.split('<br/>').map(menu => menu.replace(/\s*\([\d\.]+\)/g, '').trim());

            // 5. 사용자에게 깔끔하게 정리된 정보만 보내주기
            response.status(200).json({
                meal_time: menuInfo.MMEAL_SC_NM,
                calories: menuInfo.CAL_INFO,
                menu: menuList,
            });
        } else if (data.RESULT && data.RESULT.CODE === 'INFO-200') {
            // 급식 정보가 없는 경우
            response.status(200).json({ menu: null });
        } else {
            // API 키가 잘못되는 등 나이스에서 에러를 보낸 경우
            throw new Error(data.RESULT ? data.RESULT.MESSAGE : 'NEIS API Error');
        }
    } catch (error) {
        console.error("API 요청 에러:", error);
        response.status(500).json({ error: '서버에서 급식 정보를 가져오는 데 실패했습니다.' });
    }
}
