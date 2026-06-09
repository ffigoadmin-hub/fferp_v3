
import base64

graph = """graph TD
    Start([Request Created]) --> CheckDept{Department?}

    %% Parallel Entry Paths
    CheckDept -- Engineering --> SMO_Eng[SMO Audit]
    SMO_Eng --> GMO[GMO Audit]
    GMO --> BOI[BOI Audit]

    CheckDept -- Agri --> SMO_Agri[SMO Audit]
    SMO_Agri --> Dir[Director Audit]
    Dir --> BOI

    CheckDept -- Other --> BOI

    %% Core Pipeline
    BOI --> GM[GM Audit]
    GM --> Admin[Admin Audit]
    Admin --> CEO[CEO Audit]

    %% Final Decision
    CEO --> CheckCEO{Decision}
    CheckCEO -- Approve --> Approved[CEO Approved]
    CheckCEO -- Hold --> Hold[CEO Hold]
    CheckCEO -- Reject --> Rejected([Rejected])

    Hold --> CEO

    %% Execution
    Approved --> Accounts[Accounts / Paid]
    Accounts --> End([Completed])

    %% Rejection Paths
    BOI -- Reject --> Rejected
    GM -- Reject --> Rejected
    Admin -- Reject --> Rejected
    SMO_Eng -- Reject --> Rejected
    SMO_Agri -- Reject --> Rejected
    GMO -- Reject --> Rejected
    Dir -- Reject --> Rejected
    
    classDef default fill:#f9f9f9,stroke:#333,stroke-width:1px;
    classDef startend fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef audit fill:#fff3e0,stroke:#e65100,stroke-width:1px;
    classDef success fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef reject fill:#ffebee,stroke:#c62828,stroke-width:1px;
    
    class Start,End,CheckDept,CheckCEO startend;
    class SMO_Eng,GMO,BOI,SMO_Agri,Dir,GM,Admin,CEO,Hold audit;
    class Approved,Accounts success;
    class Rejected reject;
"""

url = 'https://mermaid.ink/img/' + base64.b64encode(graph.encode('utf-8')).decode('utf-8')
print(url)
