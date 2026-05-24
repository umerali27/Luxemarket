pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = 'umerali27'
        IMAGE_NAME      = 'luxemarket-api'
        CONTAINER_NAME  = 'luxemarket-app'
        PORT            = '3001'
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

        stage('Deploy Successfully') {
            steps {
                echo "Deploying container ${CONTAINER_NAME} on port ${PORT}..."
                sh """
                docker stop ${CONTAINER_NAME} || true
                docker rm ${CONTAINER_NAME} || true
                docker run -d \
                  -p ${PORT}:${PORT} \
                  --name ${CONTAINER_NAME} \
                  ${DOCKER_HUB_USER}/${IMAGE_NAME}:latest
                """
                
                echo 'Verifying container health...'
                sh "sleep 5"
                sh "docker ps | grep ${CONTAINER_NAME}"
                echo 'Application deployed successfully!'
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
