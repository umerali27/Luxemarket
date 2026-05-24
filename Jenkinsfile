pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = 'umerali27'
        IMAGE_NAME      = 'luxemarket-api'
        CONTAINER_NAME  = 'luxemarket-app'
        PORT            = '3001'
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                echo 'Building the Docker image...'
                sh "docker build -t ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER} -t ${DOCKER_HUB_USER}/${IMAGE_NAME}:latest ."
            }
        }

        stage('Push to Docker Hub') {
            steps {
                echo 'Logging into Docker Hub and pushing image...'
                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh "echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin"
                    sh "docker push ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER}"
                    sh "docker push ${DOCKER_HUB_USER}/${IMAGE_NAME}:latest"
                }
            }
        }

        stage('Deploy Container') {
            steps {
                echo 'Deploying application locally from the Docker Hub image...'
                sh """
                docker stop ${CONTAINER_NAME} || true
                docker rm ${CONTAINER_NAME} || true
                docker run -d \
                  -p ${PORT}:${PORT} \
                  --name ${CONTAINER_NAME} \
                  ${DOCKER_HUB_USER}/${IMAGE_NAME}:latest
                """
            }
        }

        stage('Sanity Check') {
            steps {
                echo 'Checking if container is running stable...'
                sh "sleep 5"
                sh "docker ps | grep ${CONTAINER_NAME}"
            }
        }
    }

    post {
        always {
            echo 'Cleaning up local images to save EC2 space...'
            sh "docker rmi ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER} || true"
            sh 'docker image prune -f || true'
        }
    }
}
