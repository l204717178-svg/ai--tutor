import { WorkspaceLayout } from "@/components/Layout/WorkspaceLayout"
import { StudyView } from "@/components/Study/StudyView"
import { AssignmentView } from "@/components/Assignment/AssignmentView"
import { RevisionView } from "@/components/Revision/RevisionView"
import useFileStore from "@/store/useFileStore"

function App() {
  const { currentMode } = useFileStore()

  const renderContent = () => {
    switch (currentMode) {
      case 'study':
        return <StudyView />
      case 'assignment':
        return <AssignmentView />
      case 'revision':
        return <RevisionView />
      default:
        return <StudyView />
    }
  }

  return (
    <WorkspaceLayout>
      {renderContent()}
    </WorkspaceLayout>
  )
}

export default App
