pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = 'umerali2727'
        IMAGE_NAME      = 'luxemarket-api'
    }

    stages {
        stage('Git Clone') {
            steps {
                echo 'Cloning repository from GitHub...'
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                echo "Building application Docker image: ${IMAGE_NAME}..."
                sh "docker build -t ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER} -t ${DOCKER_HUB_USER}/${IMAGE_NAME}:latest ."
            }
        }

        stage('Push Docker Image') {
            steps {
                echo 'Authenticating and pushing image to Docker Hub...'
                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh "echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin"
                    sh "docker push ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER}"
                    sh "docker push ${DOCKER_HUB_USER}/${IMAGE_NAME}:latest"
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                echo 'Deploying application to KinD Cluster...'
                
                // Dynamically updates the manifest file to use the current unique Jenkins build tag
                sh "sed -i 's|${DOCKER_HUB_USER}/${IMAGE_NAME}:latest|${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER}|g' k8s/deployment.yaml"
                
                // Applies the directory containing your manifests
                sh "kubectl apply -f k8s/"
                
                // Verifies that the deployment rolled out successfully without issues
                sh "kubectl rollout status deployment/luxemarket-api-deployment"
                echo 'Application deployed successfully to Kubernetes!'
            }
        }
    }

    post {
        always {
            echo 'Cleaning up local workspace build layers...'
            sh "docker rmi ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER} || true"
            sh 'docker image prune -f || true'
        }
    }
}
