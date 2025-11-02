"""
스탯 계산 시스템

LLM을 활용하여 사용자의 대화 내용을 분석하고,
선수 스탯에 미치는 영향을 자동으로 계산합니다.
"""

from typing import Dict, Tuple
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import json


class StatCalculator:
    """
    대화 기반 스탯 변화 계산기

    사용자와 챗봇의 대화를 분석하여:
    1. 각 스탯에 미치는 영향 평가
    2. 변화량 계산 (-10 ~ +10)
    3. 변화 이유 설명
    """

    def __init__(self, llm: ChatOpenAI):
        """
        Args:
            llm: ChatOpenAI 인스턴스
        """
        self.llm = llm

    def analyze_conversation(
        self,
        user_message: str,
        bot_reply: str,
        game_state,
        conversation_context: str = None
    ) -> Tuple[Dict[str, int], str]:
        """
        대화 내용을 분석하여 스탯 변화 계산

        Args:
            user_message: 사용자 메시지
            bot_reply: 봇 응답
            game_state: 현재 게임 상태
            conversation_context: 대화 맥락 (선택)

        Returns:
            (스탯 변화 딕셔너리, 설명 텍스트)
            예: ({"intimacy": +5, "mental": +3}, "긍정적인 격려로 자신감 상승")
        """

        # 현재 스탯 정보
        current_stats = {
            "intimacy": game_state.stats.intimacy,
            "mental": game_state.stats.mental,
            "stamina": game_state.stats.stamina,
            "power": game_state.stats.power,
            "speed": game_state.stats.speed
        }

        # LLM 프롬프트 구성
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 야구 선수 코칭 상황을 분석하는 전문가입니다.

코치(사용자)와 선수(AI)의 대화를 분석하여, 다음 스탯에 미칠 영향을 평가하세요:

**스탯 종류 및 변화 범위:**
- intimacy (친밀도): -10 ~ +10
  * 공감, 격려, 개인적 관심 → 상승
  * 무시, 비난, 강압적 태도 → 하락

- mental (멘탈): -10 ~ +10
  * 자신감 부여, 성공 경험 강조 → 상승
  * 비판, 실패 강조, 압박 → 하락

- stamina (체력): -5 ~ +5
  * 체력 훈련 언급, 휴식 권장 → 변화
  * 과도한 훈련 → 하락

- power (힘): -5 ~ +5
  * 근력 훈련 언급, 타격 연습 → 변화

- speed (주루능력): -5 ~ +5
  * 주루 훈련 언급, 도루 연습 → 변화
  * 도루 관련 부정적 언급 → 하락 (트라우마 고려)

**중요:**
- 일반적인 대화는 스탯 변화가 적거나 없을 수 있습니다
- 구체적인 훈련이나 감정적 교류가 있을 때만 큰 변화
- 선수의 트라우마(도루 공포증)를 고려하세요
- 현재 친밀도가 낮으면 긍정적 효과도 제한적입니다

**응답 형식 (JSON):**
{{
    "stat_changes": {{
        "intimacy": 0,
        "mental": 0,
        "stamina": 0,
        "power": 0,
        "speed": 0
    }},
    "reason": "변화 이유를 한 문장으로 설명",
    "analysis": "상세 분석 (선택)"
}}

변화가 없는 스탯은 0으로 설정하거나 생략 가능합니다."""),
            ("human", """[현재 게임 상태]
- 현재 시점: {current_month}월
- 현재 스탯: {current_stats}

[이번 대화]
코치(사용자): {user_message}
민석(AI): {bot_reply}

{context_info}

이 대화가 민석의 스탯에 미치는 영향을 분석해주세요.""")
        ])

        chain = prompt | self.llm

        try:
            # 컨텍스트 정보 구성
            context_info = f"[대화 맥락]\n{conversation_context}" if conversation_context else ""

            response = chain.invoke({
                "current_month": game_state.current_month,
                "current_stats": json.dumps(current_stats, ensure_ascii=False),
                "user_message": user_message,
                "bot_reply": bot_reply,
                "context_info": context_info
            })

            # JSON 파싱
            result = json.loads(response.content)
            stat_changes = result.get('stat_changes', {})
            reason = result.get('reason', '대화 분석 완료')

            # 0인 값 제거 (깔끔한 출력을 위해)
            stat_changes = {k: v for k, v in stat_changes.items() if v != 0}

            return (stat_changes, reason)

        except (json.JSONDecodeError, KeyError) as e:
            print(f"[WARNING] 스탯 분석 실패 ({type(e).__name__}): {e}")
            return ({}, "스탯 분석 실패")

    def calculate_training_bonus(
        self,
        training_type: str,
        game_state
    ) -> Dict[str, int]:
        """
        훈련 타입별 스탯 보너스 계산

        Args:
            training_type: "체력", "근력", "주루", "타격" 등
            game_state: 현재 게임 상태

        Returns:
            스탯 변화 딕셔너리
        """

        training_effects = {
            "체력": {"stamina": 5, "mental": 2},
            "근력": {"power": 5, "stamina": -2},
            "주루": {"speed": 5, "mental": 3},  # 도루 극복 시 멘탈 상승
            "타격": {"power": 3, "mental": 2},
            "멘탈": {"mental": 5, "intimacy": 2}
        }

        return training_effects.get(training_type, {})

    def get_intimacy_level(self, intimacy: int) -> str:
        """
        친밀도 레벨 텍스트 반환

        Args:
            intimacy: 친밀도 값 (0-100)

        Returns:
            레벨 설명 문자열
        """
        if intimacy < 20:
            return "매우 낮음 - 거의 대화하지 않으려 함"
        elif intimacy < 40:
            return "낮음 - 방어적이고 거리를 둠"
        elif intimacy < 60:
            return "보통 - 조금씩 마음을 열기 시작"
        elif intimacy < 80:
            return "높음 - 신뢰하고 협조적"
        else:
            return "매우 높음 - 진심으로 존경하고 따름"
