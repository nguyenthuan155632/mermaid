import { db } from "@/db";
import { sampleDiagrams } from "@/db/schema";

export const sampleDiagramsData = [
  {
    title: "Basic Flowchart",
    code: `flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]`,
    description: "A simple flowchart example",
    category: "flowchart",
    order: 1,
  },
  {
    title: "Sequence Diagram",
    code: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob, how are you?
    B-->>A: Great!
    A->>B: See you later!`,
    description: "A basic sequence diagram",
    category: "sequence",
    order: 2,
  },
  {
    title: "Class Diagram",
    code: `classDiagram
    class Animal {
        +String name
        +int age
        +eat()
        +sleep()
    }
    class Dog {
        +String breed
        +bark()
    }
    class Cat {
        +int lives
        +meow()
    }
    Animal <|-- Dog
    Animal <|-- Cat`,
    description: "Object-oriented class diagram",
    category: "class",
    order: 3,
  },
  {
    title: "State Diagram",
    code: `stateDiagram-v2
    [*] --> Still
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,
    description: "State machine diagram",
    category: "state",
    order: 4,
  },
  {
    title: "Entity Relationship",
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    PRODUCT ||--o{ LINE-ITEM : "ordered in"
    CUSTOMER {
        string name
        string email
    }
    ORDER {
        int orderNumber
        date orderDate
    }`,
    description: "Database ER diagram",
    category: "er",
    order: 5,
  },
  {
    title: "Gantt Chart",
    code: `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Task 1 :a1, 2024-01-01, 30d
    Task 2 :a2, after a1, 20d
    section Phase 2
    Task 3 :a3, 2024-02-01, 30d
    Task 4 :a4, after a3, 25d`,
    description: "Project timeline Gantt chart",
    category: "gantt",
    order: 6,
  },
  {
    title: "Pie Chart",
    code: `pie title Sales Distribution
    "Product A" : 42.1
    "Product B" : 30.2
    "Product C" : 15.3
    "Product D" : 12.4`,
    description: "Data visualization pie chart",
    category: "pie",
    order: 7,
  },
  {
    title: "User Journey",
    code: `journey
    title User Journey
    section Landing
      Visit website: 5: User
      Browse products: 4: User
    section Purchase
      Add to cart: 3: User
      Checkout: 4: User
      Payment: 5: User
    section Post-Purchase
      Receive confirmation: 5: User
      Track order: 4: User`,
    description: "User experience journey map",
    category: "user-journey",
    order: 8,
  },
];

export async function seedSampleDiagrams() {
  try {
    await db.insert(sampleDiagrams).values(sampleDiagramsData).onConflictDoNothing();
  } catch (error) {
    console.error("Failed to seed sample diagrams", error);
  }
}

