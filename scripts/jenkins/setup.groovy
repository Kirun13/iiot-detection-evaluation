import jenkins.model.Jenkins
import jenkins.model.JenkinsLocationConfiguration
import hudson.model.Node
import hudson.security.HudsonPrivateSecurityRealm
import hudson.security.FullControlOnceLoggedInAuthorizationStrategy
import hudson.security.csrf.DefaultCrumbIssuer
import hudson.slaves.DumbSlave
import hudson.slaves.JNLPLauncher
import hudson.slaves.RetentionStrategy
import hudson.plugins.git.GitSCM
import hudson.plugins.git.UserRemoteConfig
import hudson.plugins.git.BranchSpec
import org.jenkinsci.plugins.workflow.job.WorkflowJob
import org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition

def runtime = new File(System.getenv('APPLIED_SOFT_JENKINS_RUNTIME'))
def j = Jenkins.get()
def realm = new HudsonPrivateSecurityRealm(false)
if (!realm.allUsers.any { it.id == 'admin' }) {
    realm.createAccount('admin', new File(runtime, 'secrets/admin-password.txt').text.trim())
}
j.setSecurityRealm(realm)
def authorization = new FullControlOnceLoggedInAuthorizationStrategy()
authorization.setAllowAnonymousRead(false)
j.setAuthorizationStrategy(authorization)
j.setCrumbIssuer(new DefaultCrumbIssuer(true))
j.setNumExecutors(0)
JenkinsLocationConfiguration.get().setUrl('http://127.0.0.1:8080/')
if (j.getNode('windows-docker') == null) {
    def node = new DumbSlave('windows-docker', 'Local Windows agent with Docker Desktop',
        new File(System.getProperty('user.home'), 'AppliedSoftJenkinsAgent').absolutePath, '1', Node.Mode.NORMAL, 'windows-docker',
        new JNLPLauncher(), new RetentionStrategy.Always(), [])
    j.addNode(node)
}
j.getNode('windows-docker').setRemoteFS(new File(System.getProperty('user.home'), 'AppliedSoftJenkinsAgent').absolutePath)
j.getNode('windows-docker').save()
def gitDescriptor = j.getDescriptorByType(hudson.plugins.git.GitTool.DescriptorImpl)
gitDescriptor.setInstallations(new hudson.plugins.git.GitTool('Default', new File(System.getenv('ProgramFiles'), 'Git/cmd/git.exe').absolutePath, []))
gitDescriptor.save()
if (j.getItem('iiot-assignment-5') == null) {
    def job = j.createProject(WorkflowJob, 'iiot-assignment-5')
    def scm = new GitSCM([new UserRemoteConfig('https://github.com/Kirun13/iiot-detection-evaluation.git', null, null, null)],
        [new BranchSpec('*/feature/assignment-5-ci')], false, [], null, null, [])
    def definition = new CpsScmFlowDefinition(scm, 'Jenkinsfile')
    definition.setLightweight(true)
    job.setDefinition(definition)
    job.setDescription('Assignment 5: native/container reproducibility and regression verification.')
    job.save()
}
new File(runtime, 'secrets/agent-secret.txt').text = j.getComputer('windows-docker').getJnlpMac()
j.save()
println('Assignment 5 local configuration ready.')
