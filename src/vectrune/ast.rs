#[derive(Debug, Clone, PartialEq)]
pub struct VectruneDocument {
    pub language: String,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Intent {
    WeightTimelineSurvey {
        title: String,
        intro: String,
        birth_year_prompt: String,
    },
    Onboarding {
        welcome_message: String,
        steps: Vec<String>,
        completion_message: String,
    },
    FormWizard {
        title: String,
        steps: Vec<String>,
        submit_label: String,
    },
    QADialog {
        questions: Vec<String>,
        completion_message: Option<String>,
    },
    DataCollectionFlow {
        title: String,
        fields: Vec<String>,
        completion_message: Option<String>,
    },
}

