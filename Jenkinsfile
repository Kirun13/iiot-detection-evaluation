pipeline {
    agent { label 'windows-docker' }
    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 20, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
    }
    triggers { pollSCM('* * * * *') }
    stages {
        stage('Checkout') {
            steps {
                deleteDir()
                checkout scm
            }
        }
        stage('Environment') { steps { bat 'node scripts/ci.mjs environment' } }
        stage('Dependencies') { steps { bat 'npm.cmd ci --no-audit --no-fund' } }
        stage('Typecheck') { steps { bat 'npm.cmd run typecheck' } }
        stage('Tests') {
            steps {
                bat 'npm.cmd test -- --reporter=default --reporter=junit --outputFile.junit=ci-results/tests.xml'
            }
        }
        stage('Native evaluation') { steps { bat 'node scripts/ci.mjs native' } }
        stage('Docker build') { steps { bat 'node scripts/ci.mjs build-image' } }
        stage('Container evaluation') { steps { bat 'node scripts/ci.mjs containers' } }
        stage('Reproducibility') { steps { bat 'node scripts/ci.mjs compare' } }
        stage('Package') { steps { bat 'npm.cmd pack --pack-destination ci-results' } }
    }
    post {
        always {
            junit testResults: 'ci-results/tests.xml', allowEmptyResults: true
            archiveArtifacts artifacts: 'ci-results/**', allowEmptyArchive: true, fingerprint: true
        }
    }
}
